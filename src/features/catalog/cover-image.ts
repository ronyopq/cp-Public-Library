interface CoverTransformOptions {
  zoom: number
  offsetX: number
  offsetY: number
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be loaded'))
    image.src = URL.createObjectURL(file)
  })
}

async function drawVariant(
  image: HTMLImageElement,
  fileName: string,
  size: { width: number; height: number },
  options: CoverTransformOptions,
  quality: number,
) {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is not available')
  }

  const scale = Math.max(size.width / image.width, size.height / image.height) * options.zoom
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const offsetXPx = (options.offsetX / 100) * (drawWidth * 0.18)
  const offsetYPx = (options.offsetY / 100) * (drawHeight * 0.18)
  const drawX = (size.width - drawWidth) / 2 + offsetXPx
  const drawY = (size.height - drawHeight) / 2 + offsetYPx

  context.fillStyle = '#f5f0e6'
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error('Processed image could not be created'))
          return
        }
        resolve(nextBlob)
      },
      'image/jpeg',
      quality,
    )
  })

  return new File([blob], fileName.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
  })
}

export async function createProcessedCoverFiles(
  file: File,
  options: CoverTransformOptions,
) {
  const image = await loadImage(file)
  try {
    const cover = await drawVariant(
      image,
      `${file.name.replace(/\.[^.]+$/, '')}-cover.jpg`,
      { width: 1200, height: 1800 },
      options,
      0.84,
    )
    const thumbnail = await drawVariant(
      image,
      `${file.name.replace(/\.[^.]+$/, '')}-thumb.jpg`,
      { width: 320, height: 480 },
      options,
      0.78,
    )

    return {
      cover,
      thumbnail,
    }
  } finally {
    URL.revokeObjectURL(image.src)
  }
}
