const urlParams = new URLSearchParams(window.location.search);
const pdfUrl = urlParams.get('file');

if (!pdfUrl) {
  alert('No PDF file specified in URL.');
  throw new Error('No PDF file specified in URL.');
}

let pdfDoc = null,
  pageNum = 1,
  pageRendering = false,
  pageNumPending = null,
  scale = 1,
  canvas = document.getElementById('pdf-canvas'),
  ctx = canvas.getContext('2d');

function calculateScale(viewport) {
  const containerWidth = window.innerWidth * 0.95;
  return containerWidth / viewport.width;
}

function renderPage(num) {
  pageRendering = true;
  pdfDoc.getPage(num).then(function (page) {
    let viewport = page.getViewport({ scale: 1 });
    scale = calculateScale(viewport);
    viewport = page.getViewport({ scale: scale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    const renderTask = page.render(renderContext);

    renderTask.promise.then(function () {
      pageRendering = false;
      if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
      }
    });
  });

  document.getElementById('page_num').textContent = num;
}

function queueRenderPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    renderPage(num);
  }
}

function onPrevPage() {
  if (pageNum <= 1) return;
  pageNum--;
  queueRenderPage(pageNum);
}

function onNextPage() {
  if (pageNum >= pdfDoc.numPages) return;
  pageNum++;
  queueRenderPage(pageNum);
}

pdfjsLib.getDocument(pdfUrl).promise
  .then(function (pdfDoc_) {
    pdfDoc = pdfDoc_;
    document.getElementById('page_count').textContent = pdfDoc.numPages;
    renderPage(pageNum);
  })
  .catch(function (error) {
    alert('Error loading PDF: ' + error.message);
  });

document.getElementById('prev').addEventListener('click', onPrevPage);
document.getElementById('next').addEventListener('click', onNextPage);

window.addEventListener('resize', () => {
  if (pdfDoc) {
    queueRenderPage(pageNum);
  }
});
