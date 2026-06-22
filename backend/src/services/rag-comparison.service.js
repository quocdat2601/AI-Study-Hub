const ragService = require('./rag.service');
const { normalizeComparable } = require('./chat-context.service');

const PER_DOCUMENT_CANDIDATES = 24;
const VECTOR_CANDIDATES = 4;
const MAX_ALIGNED_GROUPS = 3;
const MIN_VECTOR_RELEVANCE = 0.2;
const MIN_TOPIC_OVERLAP = 0.12;
const COMPARISON_STOP_WORDS = new Set([
  'compare', 'comparison', 'versus', 'difference', 'differences', 'different',
  'document', 'documents', 'file', 'files', 'only', 'brief', 'briefly', 'shorter',
  'so', 'sanh', 'doi', 'chieu', 'khac', 'nhau', 'diem', 'tai', 'lieu', 'ngan',
  'gon', 'hon', 'chi', 'neu', 'trong', 'cua', 'hai',
  'both', 'state', 'list', 'mention', 'point', 'points', 'three', 'two', 'current', 'focus',
]);
const PROVIDER_TERMS = new Set([
  'firebase', 'supabase', 'mysql', 'postgresql', 'postgres', 'railway',
  'firestore', 'sequelize', 'prisma', 'sdk',
]);
const FOCUSED_TOPIC_TERMS = new Set([
  ...PROVIDER_TERMS,
  'persistence', 'installation', 'infrastructure', 'provider', 'constraint',
  'constraints', 'function', 'functions', 'perspective', 'architecture',
]);
const STRUCTURAL_PRIORITY_PATTERN = /product perspective|software interfaces?|product constraints?|assumptions?|dependencies|installation|database|persistence|deployment|infrastructure|architecture/iu;
const DATABASE_TOPIC_PATTERN = /\b(database|db|co so du lieu|persistence|relational)\b/;
const DATABASE_NEGATIVE_PATTERNS = [
  /sql injection/,
  /cross site scripting|\bxss\b/,
  /input validation/,
  /api key|secret key/,
  /compliance|regulation/,
  /activity log|audit log|logging activit/,
];
const DATABASE_POSITIVE_PATTERNS = [
  [/\bmysql\b/, 6],
  [/\bpostgresql\b|\bpostgres\b/, 6],
  [/supabase database|supabase postgres/, 5],
  [/railway database|mysql.{0,30}railway|railway.{0,30}mysql/, 5],
  [/database engine|database hosting|relational persistence/, 4],
  [/persistent storage|data persistence|persistence layer/, 3],
  [/\bdatabase\b|co so du lieu/, 1],
];

function expandComparisonQuery(question) {
  const normalized = normalizeComparable(question);
  const expansions = [];
  if (/\b(database|db|co so du lieu)\b/.test(normalized)) {
    expansions.push('database mysql postgresql postgres firebase supabase storage railway persistence hosting deployment');
  }
  if (/\b(storage|file|upload|bucket)\b/.test(normalized)) {
    expansions.push('storage firebase supabase bucket object file upload');
  }
  if (/\b(deploy|deployment|installation|hosting|railway)\b/.test(normalized)) {
    expansions.push('deployment installation hosting railway supabase environment database');
  }
  return [question, ...expansions].filter(Boolean).join(' ');
}

function chunkDocumentId(chunk) {
  return Number(chunk.doc_id || chunk.metadata?.documentId);
}

function chunkKey(chunk) {
  return chunk.id == null
    ? `${chunkDocumentId(chunk)}:${chunk.chunk_index}`
    : String(chunk.id);
}

function normalizeHeading(value) {
  return normalizeComparable(value)
    .replace(/^\d+(?:\s+\d+)*\s+/, '')
    .replace(/\b(section|chapter|requirement|muc|phan|chuong)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function topicTerms(text) {
  return new Set(ragService.tokenize(normalizeComparable(text))
    .filter((term) => !COMPARISON_STOP_WORDS.has(term)));
}

function overlapScore(left, right) {
  const a = left instanceof Set ? left : topicTerms(left);
  const b = right instanceof Set ? right : topicTerms(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const term of a) if (b.has(term)) intersection += 1;
  return intersection / Math.max(1, Math.min(a.size, b.size));
}

function contentDifferenceScore(chunks) {
  if (chunks.length < 2) return 0;
  const sets = chunks.map((chunk) => topicTerms(chunk.content));
  let total = 0;
  let pairs = 0;
  for (let left = 0; left < sets.length; left += 1) {
    for (let right = left + 1; right < sets.length; right += 1) {
      total += 1 - overlapScore(sets[left], sets[right]);
      pairs += 1;
    }
  }
  return pairs ? total / pairs : 0;
}

function providerDifferenceScore(chunks) {
  const providerSets = chunks.map((chunk) => new Set(
    [...topicTerms(chunk.content)].filter((term) => PROVIDER_TERMS.has(term))
  ));
  if (providerSets.some((terms) => !terms.size)) return 0;
  const union = new Set(providerSets.flatMap((terms) => [...terms]));
  const shared = [...union].filter((term) => providerSets.every((terms) => terms.has(term)));
  return union.size ? (union.size - shared.length) / union.size : 0;
}

function extractTechnologyEntities(text) {
  const normalized = normalizeComparable(text);
  const database = [];
  const fileStorage = [];
  const hosting = [];
  const sdk = [];

  if (/\bmysql\b/.test(normalized)) database.push('MySQL');
  if (/\bpostgresql\b|\bpostgres\b/.test(normalized)) database.push('PostgreSQL');
  if (/firebase storage/.test(normalized)) fileStorage.push('Firebase Storage');
  if (/supabase storage/.test(normalized)) fileStorage.push('Supabase Storage');
  if (/firebase sdk/.test(normalized)) sdk.push('Firebase SDK');
  if (/supabase sdk/.test(normalized)) sdk.push('Supabase SDK');

  const hasDatabaseContext = database.length > 0
    || /database hosting|database engine|persistence layer|relational persistence/.test(normalized);
  if (hasDatabaseContext && /\brailway\b/.test(normalized)) hosting.push('Railway');
  if (hasDatabaseContext && /\bsupabase\b/.test(normalized)) hosting.push('Supabase');

  return { database, fileStorage, hosting, sdk };
}

function buildAllowedDifferenceClaims(groups, documents) {
  const documentById = new Map((documents || []).map((document) => [Number(document.id), document]));
  const claims = [];
  const seen = new Set();

  for (const group of groups || []) {
    const entityRows = group.chunks.map((chunk) => ({
      documentId: chunkDocumentId(chunk),
      documentTitle: documentById.get(chunkDocumentId(chunk))?.title || null,
      chunkId: chunk.id ?? null,
      chunkIndex: chunk.chunk_index,
      entities: extractTechnologyEntities(chunk.content),
    }));
    for (const category of ['database', 'hosting', 'fileStorage', 'sdk']) {
      const values = entityRows.map((row) => row.entities[category]);
      if (values.some((value) => !value.length)) continue;
      const normalizedValues = values.map((value) => [...new Set(value)].sort().join('|'));
      if (new Set(normalizedValues).size < 2) continue;
      const key = `${category}:${normalizedValues.join('::')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push({
        category,
        values: entityRows.map((row, index) => ({
          documentId: row.documentId,
          documentTitle: row.documentTitle,
          value: values[index].join(' + '),
          chunkId: row.chunkId,
          chunkIndex: row.chunkIndex,
        })),
      });
    }
  }
  return claims;
}

function buildGroundedProviderAnswer({ claims, databaseOnly = false, compact = false }) {
  const databaseClaim = (claims || []).find((claim) => claim.category === 'database');
  const hostingClaim = (claims || []).find((claim) => claim.category === 'hosting');
  const storageClaim = (claims || []).find((claim) => claim.category === 'fileStorage');
  const formatDatabase = () => {
    if (!databaseClaim || databaseClaim.values.length !== 2) return null;
    return databaseClaim.values.map((entry) => {
      const hosting = hostingClaim?.values.find((item) => item.documentId === entry.documentId)?.value;
      return `${entry.documentTitle} dùng ${entry.value}${hosting ? ` trên ${hosting}` : ''}`;
    }).join('; ');
  };
  const databaseText = formatDatabase();
  if (databaseOnly || compact) return databaseText ? `${databaseText}.` : null;

  const points = [];
  if (storageClaim?.values.length === 2) {
    points.push(`Lưu trữ tệp: ${storageClaim.values.map((entry) => (
      `${entry.documentTitle} dùng ${entry.value}`
    )).join('; ')}.`);
  }
  if (databaseText) points.push(`Cơ sở dữ liệu: ${databaseText}.`);
  return points.length ? points.map((point) => `- ${point}`).join('\n') : null;
}

function scoreTopicCandidate(chunk, query) {
  const normalizedQuery = normalizeComparable(query);
  const content = normalizeComparable(`${chunk.metadata?.sectionHeading || ''} ${chunk.content || ''}`);
  const databaseTopic = DATABASE_TOPIC_PATTERN.test(normalizedQuery);
  const databaseProviderEvidence = /\bmysql\b|\bpostgresql\b|\bpostgres\b|supabase database|railway database|database engine|database hosting|relational persistence|persistence layer/.test(content);
  let positiveTopicScore = 0;
  let negativeTopicScore = 0;

  if (databaseTopic) {
    for (const [pattern, weight] of DATABASE_POSITIVE_PATTERNS) {
      if (pattern.test(content)) positiveTopicScore += weight;
    }
    for (const pattern of DATABASE_NEGATIVE_PATTERNS) {
      if (pattern.test(content)) negativeTopicScore += 8;
    }
    if (STRUCTURAL_PRIORITY_PATTERN.test(String(chunk.metadata?.sectionHeading || ''))) {
      positiveTopicScore += 2;
    }
    const hasArchitectureProvider = /firebase|supabase|mysql|postgresql|postgres|railway/.test(content);
    if (hasArchitectureProvider && /storage|sdk|quota|deploy|hosting/.test(content)) {
      positiveTopicScore += 2;
    }
  }

  return { databaseTopic, databaseProviderEvidence, positiveTopicScore, negativeTopicScore };
}

function decorateCandidatesForTopic(candidatesByDocument, documentIds, query) {
  return new Map(documentIds.map((docId) => [
    docId,
    (candidatesByDocument.get(docId) || []).map((chunk) => ({
      ...chunk,
      ...scoreTopicCandidate(chunk, query),
    })),
  ]));
}

function deriveStructureForChunks(chunks) {
  const byDocument = new Map();
  for (const chunk of chunks || []) {
    const docId = chunkDocumentId(chunk);
    const list = byDocument.get(docId) || [];
    list.push(chunk);
    byDocument.set(docId, list);
  }

  const enriched = [];
  for (const list of byDocument.values()) {
    list.sort((a, b) => Number(a.chunk_index || 0) - Number(b.chunk_index || 0));
    for (let index = 0; index < list.length; index += 1) {
      const chunk = list[index];
      const previous = list[index - 1];
      const next = list[index + 1];
      const ownIds = chunk.metadata?.requirementIds?.length
        ? chunk.metadata.requirementIds
        : ragService.extractRequirementIds(chunk.content);
      const ownHeading = chunk.metadata?.sectionHeading
        || ragService.inferSectionHeading(chunk.content, 0);
      const previousIds = previous
        ? previous.metadata?.requirementIds || ragService.extractRequirementIds(previous.content)
        : [];
      const nextIds = next
        ? next.metadata?.requirementIds || ragService.extractRequirementIds(next.content)
        : [];
      const previousHeading = previous
        ? previous.metadata?.sectionHeading || ragService.inferSectionHeading(previous.content, 0)
        : null;
      const nextHeading = next
        ? next.metadata?.sectionHeading || ragService.inferSectionHeading(next.content, 0)
        : null;
      const requirementIds = ownIds.length ? ownIds : previousIds.length ? previousIds : nextIds;
      const sectionHeading = ownHeading || previousHeading || nextHeading || null;
      const structuralNeighbor = ownIds.length || ownHeading
        ? null
        : previousIds.length || previousHeading ? previous : next || null;

      enriched.push({
        ...chunk,
        metadata: {
          ...(chunk.metadata || {}),
          requirementIds,
          sectionHeading,
          structuralNeighborId: structuralNeighbor?.id || null,
          structuralNeighborChunkIndex: structuralNeighbor?.chunk_index ?? null,
        },
      });
    }
  }
  return enriched;
}

function mergeCandidates(keywordChunks, vectorChunks) {
  const merged = new Map();
  const maxKeyword = Math.max(0, ...keywordChunks.map((chunk) => Number(chunk.score || 0)));
  for (const chunk of keywordChunks) {
    const keywordScore = Number(chunk.score || 0);
    const existing = merged.get(chunkKey(chunk));
    if (existing && Number(existing.keywordScore || 0) > keywordScore) continue;
    merged.set(chunkKey(chunk), {
      ...(existing || {}),
      ...chunk,
      keywordScore,
      normalizedKeywordScore: maxKeyword ? keywordScore / maxKeyword : 0,
      vectorScore: 0,
    });
  }
  for (const chunk of vectorChunks) {
    const key = chunkKey(chunk);
    const existing = merged.get(key) || {};
    merged.set(key, {
      ...chunk,
      ...existing,
      metadata: { ...(chunk.metadata || {}), ...(existing.metadata || {}) },
      vectorScore: Number(chunk.similarity || 0),
    });
  }
  return [...merged.values()]
    .map((chunk) => ({
      ...chunk,
      score: (0.7 * Number(chunk.vectorScore || 0))
        + (0.3 * Number(chunk.normalizedKeywordScore || 0)),
    }))
    .sort((a, b) => b.score - a.score);
}

function buildCompleteGroups(candidatesByDocument, documentIds, getKeys, strategy) {
  const keyMaps = documentIds.map((docId) => {
    const map = new Map();
    for (const chunk of candidatesByDocument.get(docId) || []) {
      for (const key of getKeys(chunk)) {
        if (!key) continue;
        const existing = map.get(key);
        if (!existing || Number(chunk.score || 0) > Number(existing.score || 0)) map.set(key, chunk);
      }
    }
    return map;
  });
  const commonKeys = [...(keyMaps[0]?.keys() || [])]
    .filter((key) => keyMaps.every((map) => map.has(key)));
  return commonKeys.map((key) => {
    const chunks = keyMaps.map((map) => map.get(key));
    const relevance = chunks.reduce((sum, chunk) => sum + Number(chunk.score || 0), 0) / chunks.length;
    const differenceScore = contentDifferenceScore(chunks);
    const providerDifference = providerDifferenceScore(chunks);
    const structuralPriority = chunks.some((chunk) => (
      STRUCTURAL_PRIORITY_PATTERN.test(String(chunk.metadata?.sectionHeading || ''))
    )) ? 0.15 : 0;
    return {
      strategy,
      key,
      chunks,
      differenceScore,
      providerDifference,
      score: relevance + differenceScore + (1.5 * providerDifference) + structuralPriority,
    };
  }).sort((a, b) => b.score - a.score);
}

function buildTopicGroups(candidatesByDocument, documentIds, query) {
  const firstCandidates = candidatesByDocument.get(documentIds[0]) || [];
  const queryTerms = topicTerms(query);
  const groups = [];

  for (const anchor of firstCandidates) {
    const chunks = [anchor];
    let valid = true;
    for (const docId of documentIds.slice(1)) {
      const choices = (candidatesByDocument.get(docId) || [])
        .map((chunk) => ({
          chunk,
          overlap: overlapScore(topicTerms(anchor.content), topicTerms(chunk.content)),
        }))
        .sort((a, b) => b.overlap - a.overlap || Number(b.chunk.score || 0) - Number(a.chunk.score || 0));
      if (!choices.length || choices[0].overlap < MIN_TOPIC_OVERLAP) {
        valid = false;
        break;
      }
      chunks.push(choices[0].chunk);
    }
    if (!valid) continue;
    const differenceScore = contentDifferenceScore(chunks);
    const providerDifference = providerDifferenceScore(chunks);
    const queryRelevance = chunks.reduce(
      (sum, chunk) => sum + overlapScore(queryTerms, topicTerms(chunk.content)),
      0
    ) / chunks.length;
    groups.push({
      strategy: 'topic_overlap',
      key: chunkKey(anchor),
      chunks,
      differenceScore,
      providerDifference,
      score: queryRelevance + differenceScore + (1.5 * providerDifference),
    });
  }
  return groups.sort((a, b) => b.score - a.score);
}

function selectProgressiveGroups(candidatesByDocument, documentIds, query) {
  const expandedQuery = expandComparisonQuery(query);
  const scoredCandidates = decorateCandidatesForTopic(candidatesByDocument, documentIds, expandedQuery);
  const queryTopicTerms = topicTerms(expandedQuery);
  const hasSpecificTopic = [...queryTopicTerms].some((term) => FOCUSED_TOPIC_TERMS.has(term));
  const databaseTopic = DATABASE_TOPIC_PATTERN.test(normalizeComparable(expandedQuery));
  const rankAndFilterGroups = (groups) => groups
    .map((group) => {
      const chunkRelevance = group.chunks.map((chunk) => overlapScore(
        queryTopicTerms,
        topicTerms(`${chunk.metadata?.sectionHeading || ''} ${chunk.content}`)
      ));
      const queryRelevance = chunkRelevance.reduce((sum, score) => sum + score, 0)
        / chunkRelevance.length;
      const positiveTopicScore = group.chunks.reduce(
        (sum, chunk) => sum + Number(chunk.positiveTopicScore || 0),
        0
      ) / group.chunks.length;
      const negativeTopicScore = group.chunks.reduce(
        (sum, chunk) => sum + Number(chunk.negativeTopicScore || 0),
        0
      );
      return {
        ...group,
        queryRelevance,
        chunkRelevance,
        positiveTopicScore,
        negativeTopicScore,
        score: group.score + (2 * queryRelevance) + positiveTopicScore - negativeTopicScore,
      };
    })
    .filter((group) => {
      if (group.differenceScore < 0.15 && group.providerDifference <= 0) return false;
      if (databaseTopic) {
        return group.providerDifference > 0
          && group.negativeTopicScore === 0
          && group.chunks.every((chunk) => (
            chunk.databaseProviderEvidence
            && Number(chunk.positiveTopicScore || 0) >= 2
          ));
      }
      if (hasSpecificTopic) return group.chunkRelevance.every((score) => score > 0);
      return group.differenceScore >= 0.05 || group.providerDifference > 0;
    })
    .sort((a, b) => b.score - a.score);
  const requirementGroups = rankAndFilterGroups(buildCompleteGroups(
    scoredCandidates,
    documentIds,
    (chunk) => chunk.metadata?.requirementIds || [],
    'requirement_id'
  ));
  if (requirementGroups.length) {
    const providerGroups = requirementGroups.filter((group) => group.providerDifference > 0);
    return (providerGroups.length ? providerGroups : requirementGroups).slice(0, MAX_ALIGNED_GROUPS);
  }

  const headingGroups = rankAndFilterGroups(buildCompleteGroups(
    scoredCandidates,
    documentIds,
    (chunk) => [normalizeHeading(chunk.metadata?.sectionHeading)],
    'section_heading'
  ));
  if (headingGroups.length) {
    const providerGroups = headingGroups.filter((group) => group.providerDifference > 0);
    return (providerGroups.length ? providerGroups : headingGroups).slice(0, MAX_ALIGNED_GROUPS);
  }

  const topicGroups = rankAndFilterGroups(buildTopicGroups(scoredCandidates, documentIds, expandedQuery))
    .filter((group) => !hasSpecificTopic || group.chunks.every((chunk) => (
      overlapScore(queryTopicTerms, topicTerms(chunk.content)) > 0
    )));
  if (topicGroups.length) return topicGroups.slice(0, MAX_ALIGNED_GROUPS);

  const balancedChunks = [];
  for (const docId of documentIds) {
    const candidates = scoredCandidates.get(docId) || [];
    const relevant = candidates.find((chunk) => (
      Number(chunk.keywordScore || 0) > 0 || Number(chunk.vectorScore || 0) >= MIN_VECTOR_RELEVANCE
    ) && (!hasSpecificTopic || overlapScore(queryTopicTerms, topicTerms(chunk.content)) > 0)
      && (!databaseTopic || (
        chunk.databaseProviderEvidence
        &&
        Number(chunk.positiveTopicScore || 0) >= 2
        && Number(chunk.negativeTopicScore || 0) === 0
      )));
    if (!relevant) return [];
    balancedChunks.push(relevant);
  }
  return [{
    strategy: 'balanced',
    key: 'balanced',
    chunks: balancedChunks,
    score: balancedChunks.reduce((sum, chunk) => sum + Number(chunk.score || 0), 0)
      / balancedChunks.length,
  }];
}

function applyContextBudget(groups, allChunks, documentIds) {
  const selected = [];
  const seen = new Set();
  for (const group of groups) {
    for (const chunk of group.chunks) {
      if (!seen.has(chunkKey(chunk))) {
        seen.add(chunkKey(chunk));
        selected.push(chunk);
      }
    }
  }

  const byKey = new Map((allChunks || []).map((chunk) => [chunkKey(chunk), chunk]));
  for (const chunk of [...selected]) {
    const neighborId = chunk.metadata?.structuralNeighborId;
    const neighborIndex = chunk.metadata?.structuralNeighborChunkIndex;
    const neighbor = neighborId != null
      ? byKey.get(String(neighborId))
      : (allChunks || []).find((candidate) => (
        chunkDocumentId(candidate) === chunkDocumentId(chunk)
        && Number(candidate.chunk_index) === Number(neighborIndex)
      ));
    if (neighbor && !seen.has(chunkKey(neighbor))) {
      seen.add(chunkKey(neighbor));
      selected.push({
        ...neighbor,
        metadata: { ...(neighbor.metadata || {}), retrieval: 'structural_neighbor' },
      });
    }
  }

  const maxChars = ragService.MAX_CONTEXT_CHARS;
  const primaryBudget = Math.max(1, Math.floor(maxChars / Math.max(1, selected.length)));
  let remaining = maxChars;
  return selected.filter((chunk) => documentIds.includes(chunkDocumentId(chunk))).map((chunk) => {
    if (remaining <= 0) return null;
    const allowance = Math.min(primaryBudget, remaining);
    const content = String(chunk.content || '');
    const promptContent = content.length > allowance
      ? `${content.slice(0, Math.max(0, allowance - 3)).trim()}...`
      : content;
    remaining -= promptContent.length;
    return {
      ...chunk,
      promptContent,
      metadata: {
        ...(chunk.metadata || {}),
        retrieval: chunk.metadata?.retrieval || 'comparison',
      },
    };
  }).filter((chunk) => chunk?.promptContent);
}

async function retrieveComparisonEvidence({ question, chunks, documents }) {
  const documentChunkModel = require('../models/document-chunk.model');
  const embeddingService = require('./embedding.service');
  const documentIds = documents.map((document) => Number(document.id));
  const expandedQuery = expandComparisonQuery(question);
  const enrichedChunks = deriveStructureForChunks(chunks);
  const chunksByDocument = new Map(documentIds.map((id) => [id, []]));
  for (const chunk of enrichedChunks) {
    const list = chunksByDocument.get(chunkDocumentId(chunk));
    if (list) list.push(chunk);
  }

  let queryEmbedding = null;
  try {
    queryEmbedding = await embeddingService.embedQuery(expandedQuery);
  } catch (error) {
    console.error('Comparison query embedding failed:', error.message);
  }

  const candidatesByDocument = new Map();
  for (const docId of documentIds) {
    const docChunks = chunksByDocument.get(docId) || [];
    const keyword = ragService.rankRelevantChunks(expandedQuery, docChunks, PER_DOCUMENT_CANDIDATES);
    let vector = [];
    if (queryEmbedding) {
      try {
        vector = await documentChunkModel.matchByEmbedding({
          docId,
          embedding: queryEmbedding.embedding,
          limit: VECTOR_CANDIDATES,
        });
      } catch (error) {
        console.error(`Comparison vector retrieval failed for document ${docId}:`, error.message);
      }
    }
    const vectorKeys = new Set(vector.map(chunkKey));
    const decoratedVector = vector.map((vectorChunk) => {
      const storedChunk = enrichedChunks.find((chunk) => chunkKey(chunk) === chunkKey(vectorChunk));
      return storedChunk ? { ...vectorChunk, ...storedChunk, similarity: vectorChunk.similarity } : vectorChunk;
    });
    const keywordKeys = new Set(keyword.map(chunkKey));
    const structuralCandidates = docChunks.slice(0, PER_DOCUMENT_CANDIDATES)
      .filter((chunk) => !vectorKeys.has(chunkKey(chunk)) && !keywordKeys.has(chunkKey(chunk)));
    candidatesByDocument.set(
      docId,
      mergeCandidates([...keyword, ...structuralCandidates], decoratedVector)
        .slice(0, PER_DOCUMENT_CANDIDATES)
    );
  }

  const groups = selectProgressiveGroups(candidatesByDocument, documentIds, question);
  const candidateDebug = [...candidatesByDocument.entries()].flatMap(([docId, candidates]) => (
    candidates.map((chunk) => {
      const topicScore = scoreTopicCandidate(chunk, expandedQuery);
      return {
        documentId: docId,
        documentTitle: documents.find((document) => Number(document.id) === Number(docId))?.title || null,
        chunkId: chunk.id ?? null,
        chunkIndex: chunk.chunk_index,
        positiveTopicScore: topicScore.positiveTopicScore,
        negativeTopicScore: topicScore.negativeTopicScore,
      };
    })
  ));
  const alignedPairDebug = groups.map((group) => ({
    strategy: group.strategy,
    key: group.key,
    score: group.score,
    chunks: group.chunks.map((chunk) => ({
      documentId: chunkDocumentId(chunk),
      chunkId: chunk.id ?? null,
      chunkIndex: chunk.chunk_index,
      positiveTopicScore: chunk.positiveTopicScore || 0,
      negativeTopicScore: chunk.negativeTopicScore || 0,
    })),
  }));
  if (process.env.RAG_COMPARISON_DEBUG === 'true') {
    console.info('RAG comparison candidates:', candidateDebug);
    console.info('RAG comparison aligned pairs:', alignedPairDebug);
  }
  if (!groups.length) {
    return {
      chunks: [],
      insufficient: true,
      metadata: {
        strategy: 'insufficient',
        confidence: 'none',
        comparedDocumentIds: documentIds,
        expandedRetrievalQuery: expandedQuery,
        candidateDebug,
        alignedPairDebug,
      },
    };
  }

  const evidence = applyContextBudget(groups, enrichedChunks, documentIds);
  const strategy = groups[0].strategy;
  const allowedDifferenceClaims = buildAllowedDifferenceClaims(groups, documents);
  return {
    chunks: evidence,
    insufficient: documentIds.some((docId) => !evidence.some((chunk) => chunkDocumentId(chunk) === docId)),
    metadata: {
      strategy,
      confidence: strategy === 'requirement_id' || strategy === 'section_heading'
        ? 'high'
        : strategy === 'topic_overlap' ? 'medium' : 'low',
      comparedDocumentIds: documentIds,
      expandedRetrievalQuery: expandedQuery,
      structureEquivalent: strategy === 'requirement_id' || strategy === 'section_heading',
      evidenceChars: evidence.reduce((sum, chunk) => sum + chunk.promptContent.length, 0),
      allowedDifferenceClaims,
      candidateDebug,
      alignedPairDebug,
    },
  };
}

function buildInsufficientEvidenceAnswer(question) {
  const vietnamese = /[ăâđêôơưáàảãạấầẩẫậéèẻẽẹíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]|\b(tài liệu|so sánh|không đủ)\b/iu
    .test(String(question || ''));
  return vietnamese
    ? 'Không có đủ bằng chứng liên quan trong tất cả tài liệu để so sánh chính xác nội dung này.'
    : 'There is not enough relevant evidence in every document to compare this accurately.';
}

module.exports = {
  applyContextBudget,
  buildInsufficientEvidenceAnswer,
  deriveStructureForChunks,
  expandComparisonQuery,
  retrieveComparisonEvidence,
  buildAllowedDifferenceClaims,
  buildGroundedProviderAnswer,
  extractTechnologyEntities,
  scoreTopicCandidate,
  selectProgressiveGroups,
  topicTerms,
};
