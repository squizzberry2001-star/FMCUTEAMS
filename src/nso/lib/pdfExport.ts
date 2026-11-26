async function waitForFrame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function waitForImages(pages: HTMLElement[]) {
  const images = pages.flatMap((page) => Array.from(page.querySelectorAll<HTMLImageElement>('img')));
  
  // Collect all CSS background-image URLs from all elements on all pages
  const bgUrls = new Set<string>();
  pages.forEach((page) => {
    const elements = [page, ...Array.from(page.querySelectorAll<HTMLElement>('*'))];
    elements.forEach((el) => {
      const bg = el.style.backgroundImage || (typeof window !== 'undefined' ? window.getComputedStyle(el).backgroundImage : '');
      if (bg && bg !== 'none') {
        const matches = bg.matchAll(/url\(["']?([^"')]+)["']?\)/g);
        for (const match of matches) {
          if (match[1] && !match[1].startsWith('data:')) {
            bgUrls.add(match[1]);
          }
        }
      }
    });
  });

  const promises: Promise<void>[] = [];

  // Wait for <img> elements to load
  images.forEach((image) => {
    if (image.complete && image.naturalWidth > 0) return;
    promises.push(new Promise<void>((resolve) => {
      const done = () => resolve();
      image.onload = done;
      image.onerror = done;
      setTimeout(done, 6000);
    }));
  });

  // Preload and decode all background-images in browser cache
  bgUrls.forEach((url) => {
    promises.push(new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const done = () => {
        if ('decode' in img) {
          img.decode().then(resolve).catch(resolve);
        } else {
          resolve();
        }
      };
      img.onload = done;
      img.onerror = () => resolve();
      img.src = url;
      setTimeout(resolve, 6000);
    }));
  });

  await Promise.all(promises);

  if ('fonts' in document) {
    await document.fonts.ready.catch(() => undefined);
  }
}

function safeFileName(fileName: string) {
  return fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
}

export async function exportReportToPdf(fileName: string) {
  if (typeof window === 'undefined') return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);

  const pages = Array.from(document.querySelectorAll<HTMLElement>('#report-preview .pdf-page'));
  if (!pages.length) throw new Error('No PDF pages found.');

  document.body.classList.add('exporting-pdf');
  await waitForFrame();
  await waitForImages(pages);
  // Ensure DOM has fully settled and all decoded images are painted before capturing
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  await waitForFrame();

  const pageWidth = 960;
  const pageHeight = 540;
  // Ultra-HD scale: 3.5 gives 3360x1890 (near 4K resolution) for razor-sharp photos and vector-crisp text
  const exportScale = 3.5;

  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: [pageWidth, pageHeight],
      compress: true,
      hotfixes: ['px_scaling']
    });

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const canvas = await html2canvas(page, {
        scale: exportScale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        removeContainer: true,
        windowWidth: pageWidth,
        windowHeight: pageHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc) => {
          doc.body.classList.add('exporting-pdf', 'pdf-hd-export');
          doc.querySelectorAll('.pdf-page-frame').forEach((frame) => {
            (frame as HTMLElement).style.width = `${pageWidth}px`;
            (frame as HTMLElement).style.height = `${pageHeight}px`;
          });
          doc.querySelectorAll('.pdf-page').forEach((slide) => {
            const el = slide as HTMLElement;
            el.style.transform = 'none';
            el.style.boxShadow = 'none';
          });
          doc.querySelectorAll('.pdf-page img, .pdf-page .photo-filled, .pdf-page .cover-photo, .pdf-page .crew-card-photo-cover').forEach((img) => {
            const el = img as HTMLElement;
            el.style.imageRendering = '-webkit-optimize-contrast';
          });
        }
      });

      const image = canvas.toDataURL('image/jpeg', 0.99);
      if (index > 0) pdf.addPage([pageWidth, pageHeight], 'landscape');
      pdf.addImage(image, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      canvas.width = 1;
      canvas.height = 1;
    }

    pdf.save(safeFileName(fileName));
  } finally {
    document.body.classList.remove('exporting-pdf');
  }
}
