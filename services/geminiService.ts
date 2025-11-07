
const preprocessImage = (file: File): Promise<{base64String: string, mimeType: string}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (readerEvent) => {
      const image = new Image();
      image.src = readerEvent.target?.result as string;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }

        // 1. Grayscale
        ctx.filter = 'grayscale(1)';
        ctx.drawImage(image, 0, 0);

        // 2. Increase Contrast
        ctx.filter = 'contrast(2)';
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

        // 3. Binarization (Thresholding)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const color = avg > 128 ? 255 : 0;
          data[i] = color;
          data[i + 1] = color;
          data[i + 2] = color;
        }
        ctx.putImageData(imageData, 0, 0);

        const dataUrl = canvas.toDataURL(file.type);
        const base64String = dataUrl.split(',')[1];
        if (base64String) {
          resolve({ base64String, mimeType: file.type });
        } else {
          reject(new Error("Failed to extract base64 string from preprocessed image."));
        }
      };
      image.onerror = (e) => reject(e);
    };
    reader.onerror = (error) => reject(error);
  });
};


export async function* extractTextFromImageStream(imageFile: File, context: string, quality: string, llm: string): AsyncGenerator<string> {
  try {
    const { base64String, mimeType } = await preprocessImage(imageFile);
    
    const response = await fetch('/api/extract-text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: base64String,
            mimeType: mimeType,
            context: context,
            quality: quality,
            llm: llm, // Pass the selected LLM to the backend
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend error: ${response.status} ${errorText}`);
    }

    if (!response.body) {
        throw new Error('Response body is empty.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        const chunk = decoder.decode(value);
        yield chunk;
    }
  } catch (error) {
    console.error("Error extracting text from image:", error);
    if (error instanceof Error) {
      throw new Error(`Extraction failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred during text extraction.");
  }
};

export async function processTextWithAI(text: string, task: 'summarize' | 'title', llm: string): Promise<string> {
  try {
    const response = await fetch('/api/extract-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        task,
        llm,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI processing error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error(`Error during AI task '${task}':`, error);
    if (error instanceof Error) {
      throw new Error(`AI task failed: ${error.message}`);
    }
    throw new Error(`An unknown error occurred during AI task '${task}'.`);
  }
}