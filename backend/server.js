require('dotenv').config();
const app = require('./src/app');

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`AI Study Hub API running on port ${port}`);
  console.log(`Swagger docs:  http://localhost:${port}/api-docs/`);
});
