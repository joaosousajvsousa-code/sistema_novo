// Reduz a foto no próprio celular antes de enviar (até 800 px, JPEG).
// Fotos de câmera têm vários MB; assim o envio fica rápido mesmo com sinal fraco.
export async function resizeImage(file: File, max = 800, quality = 0.82): Promise<Blob> {
  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível ler esta foto. Tente outra (JPG ou PNG).'));
      img.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a foto.');
  ctx.drawImage(source, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Não foi possível preparar a foto.');
  return blob;
}
