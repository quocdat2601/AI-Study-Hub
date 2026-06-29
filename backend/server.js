require('dotenv').config();
const app = require('./src/app');
const startTrashCleanupJob = require('./src/jobs/trashCleanup.job');
const startSessionDocumentCleanupJob = require('./src/jobs/sessionDocumentCleanup.job');

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`AI Study Hub API running on port ${port}`);
  console.log(`Swagger docs:  http://localhost:${port}/api-docs/`);
  startTrashCleanupJob();
  startSessionDocumentCleanupJob();
});
