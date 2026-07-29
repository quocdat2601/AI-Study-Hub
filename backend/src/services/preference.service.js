const preferenceModel = require('../models/preference.model');
const tagModel = require('../models/tag.model');
const documentModel = require('../models/document.model');
const accountModel = require('../models/account.model');
const documentService = require('./document.service');
const activityService = require('./activity.service');
const createError = require('../utils/createError');

const GOALS = new Set(['exam', 'project', 'self_study']);

async function getOptions(userId) {
  const [majors, prefs] = await Promise.all([
    preferenceModel.getMajors(),
    preferenceModel.getPreferences(userId),
  ]);


  const [subjects, suggestedTags] = await Promise.all([
    preferenceModel.getSubjectsByMajor(prefs?.major_id),
    preferenceModel.getSuggestedTagsByMajor(prefs?.major_id),
  ]);

  return { majors, subjects, suggestedTags };
}

async function getSuggestedTags(majorId) {
  return preferenceModel.getSuggestedTagsByMajor(majorId);
}

async function getSubjectsByMajor(majorId) {
  return preferenceModel.getSubjectsByMajor(majorId);
}

async function getStatus(userId) {
  const [prefs, topics, subjectIds] = await Promise.all([
    preferenceModel.getPreferences(userId),
    preferenceModel.getTopics(userId),
    preferenceModel.getSubjectIds(userId),
  ]);

  return {
    onboarded: Boolean(prefs?.onboarded_at),
    majorId: prefs?.major_id || null,
    goal: prefs?.goal || null,
    topics,
    topicIds: topics.map((topic) => topic.id),
    subjectIds,
  };
}

async function saveOnboarding(userId, { majorId, goal, subjects, topics }) {
  const normalizedGoal = String(goal || '').trim();
  if (!GOALS.has(normalizedGoal)) {
    throw createError(400, 'Goal must be one of: exam, project, self_study');
  }


  const subjectIds = [...new Set((subjects || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!subjectIds.length) {
    throw createError(400, 'Please select at least one subject');
  }


  const previous = await preferenceModel.getPreferences(userId);

  const tagNames = tagModel.parseNames((topics || []).join(','));
  const tags = [];
  for (const name of tagNames) {
    tags.push(await tagModel.findOrCreateByName(name));
  }

  await preferenceModel.setSubjects(userId, subjectIds);
  await preferenceModel.setTopics(userId, tags.map((tag) => tag.id));
  const prefs = await preferenceModel.upsertPreferences(userId, {
    majorId: majorId ? Number(majorId) : null,
    goal: normalizedGoal,
    onboardedAt: new Date().toISOString(),
  });


  if (majorId) {
    try {
      const majors = await preferenceModel.getMajors();
      const major = majors.find((m) => m.id === Number(majorId));
      if (major) await accountModel.updateProfile(userId, { major: major.name });
    } catch (err) {
      console.error('Major profile sync failed:', err.message);
    }
  }


  activityService.log({
    userId,
    action: previous?.onboarded_at ? 'onboarding.update' : 'onboarding.complete',
    metadata: { majorId: prefs.major_id, goal: prefs.goal, subjectCount: subjectIds.length, topicCount: tags.length },
  });

  return {
    onboarded: true,
    majorId: prefs.major_id,
    goal: prefs.goal,
    subjectIds,
    topicIds: tags.map((tag) => tag.id),
  };
}


async function skipOnboarding(userId) {
  const prefs = await preferenceModel.upsertPreferences(userId, {
    majorId: null,
    goal: null,
    onboardedAt: new Date().toISOString(),
  });

  activityService.log({
    userId,
    action: 'onboarding.skip',
    metadata: {},
  });

  return { onboarded: Boolean(prefs.onboarded_at) };
}

async function getRecommendations(userId, limit = 12) {
  const matches = await preferenceModel.recommendHybrid(userId, limit);

  if (!matches.length) {

    const trending = await documentModel.findTrending(limit);
    const withThumbs = await documentService.addThumbnailUrls(trending);
    return {
      reason: 'trending',
      items: withThumbs.map((doc) => ({
        ...documentService.buildPublicDocumentPreview(doc),
        subjectMatch: false,
        subjectName: null,
        matchedTags: [],
      })),
    };
  }

  const matchById = new Map(matches.map((m) => [m.doc_id, m]));
  const docs = await documentModel.findPublicByIds(matches.map((m) => m.doc_id));
  const withThumbs = await documentService.addThumbnailUrls(docs);

  const items = withThumbs
    .map((doc) => {
      const match = matchById.get(doc.id);
      return {
        ...documentService.buildPublicDocumentPreview(doc),
        score: match?.score || 0,
        subjectMatch: Boolean(match?.subject_match),
        subjectName: match?.subject_name || null,
        matchedTags: match?.matched_tags || [],
      };
    })

    .sort((a, b) => matches.findIndex((m) => m.doc_id === a.id) - matches.findIndex((m) => m.doc_id === b.id));

  return { reason: 'matched', items };
}

module.exports = {
  getOptions,
  getSuggestedTags,
  getSubjectsByMajor,
  getStatus,
  saveOnboarding,
  skipOnboarding,
  getRecommendations,
};
