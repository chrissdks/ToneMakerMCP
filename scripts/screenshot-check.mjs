/** Check raster content, since DOM visibility can precede an iframe's compositor paint. */
export async function paintedPixelCount(page, png) {
  return page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i + 3] > 0 &&
        Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 100
      )
        visible++;
    return visible;
  }, Array.from(png));
}
