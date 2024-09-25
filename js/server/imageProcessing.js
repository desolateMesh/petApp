// imageProcessing.js

import fs from 'fs';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function processImage(file) {
  const imageBuffer = fs.readFileSync(file.path);
  const base64Image = imageBuffer.toString('base64');

  const breedModel = 'salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746';

  const breedInput = {
    image: `data:image/${file.mimetype};base64,${base64Image}`,
    task: 'visual_question_answering',
    question: 'What breed is the dog?'
  };

  const breedOutput = await replicate.run(breedModel, { input: breedInput });
  const dogBreed = extractAnswer(breedOutput);

  const descriptionInput = {
    image: `data:image/${file.mimetype};base64,${base64Image}`,
    task: 'image_captioning',
    question: `What color is the dog in the picture?`
  };

  const descriptionOutput = await replicate.run(breedModel, { input: descriptionInput });
  const dogDescription = extractAnswer(descriptionOutput);

  const initialPrompt = `A highly stylized, cartoonish 3D-rendered of a ${dogDescription} ${dogBreed} with large, exaggerated eyes and rounded features, resembling a toy figurine. The style should be smooth and polished with soft textures and vibrant colors, evoking a playful and whimsical feel, if there is anything in the background remove it`;

  return { 
    prompt: initialPrompt,
    dog_breed: dogBreed, 
    dog_description: dogDescription 
  };
}

function extractAnswer(output) {
  if (typeof output === 'string') {
    return output.replace('Answer: ', '').trim();
  } else if (Array.isArray(output) && output.length > 0) {
    return output[0].replace('Answer: ', '').trim();
  }
  return 'unknown';
}

export async function generateImages(prompt) {
  const model = 'bytedance/sdxl-lightning-4step:5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637';

  const input = {
    prompt: prompt,
    num_inference_steps: 4,
  };

  const generatedImages = [];
  for (let i = 0; i < 7; i++) {
    const output = await replicate.run(model, { input: input });
    generatedImages.push(...output);
  }

  return generatedImages;
}

export async function process3DImage(imagePath) {
  const input = {
    image_path: imagePath,
    export_obj: true,
  };

  const output = await replicate.run(
    'aryamansital/instant_mesh:e353a25cc764e0edb0aa9033df0bf4b82318dcda6d0a0cd9f2aace90566068ac',
    { input }
  );

  return output;
}