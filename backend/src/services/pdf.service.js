const pdfParse = require('pdf-parse');

async function extractText(buffer) {
  const pageBoundaries = [];
  let fullText = '';

  function renderPage(pageData) {
    return pageData.getTextContent()
      .then((textContent) => {
        let lastY, text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        const pageNum = pageData.pageIndex + 1;
        const startChar = fullText.length;
        fullText += text + '\n\n';
        const endChar = fullText.length;

        pageBoundaries.push({
          pageNumber: pageNum,
          startChar,
          endChar,
        });

        return text;
      });
  }

  await pdfParse(buffer, { pagerender: renderPage });
  return {
    text: fullText,
    pageBoundaries,
  };
}

module.exports = { extractText };
