// server.js

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bodyParser from 'body-parser';

import { configureCloudinary, uploadToCloudinary } from './cloudinary.js';
import { processImage, generateImages } from '../server/imageProcessing.js';
import { configureStripe, createCheckoutSession, verifyPayment, handleWebhook } from './stripepayment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3003;

import Replicate from 'replicate';

// Initialize the Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});


// Add this line to enable development mode
const DEV_MODE = process.env.NODE_ENV === 'development';

// Serve static files from the specific directories
app.use('/css', express.static(path.join(__dirname, '../../css'), {
  setHeaders: (res) => res.set('Content-Type', 'text/css')
}));
app.use('/js', express.static(path.join(__dirname, '../../js'), {
  setHeaders: (res) => res.set('Content-Type', 'application/javascript')
}));
app.use('/images', express.static(path.join(__dirname, '../../public/images')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Serve HTML files
app.use(express.static(path.join(__dirname, '../../')));

// Configure Cloudinary
configureCloudinary();

// Configure Stripe
const stripe = configureStripe();

// Ensure the 'uploads' directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

// Routes
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const result = await processImage(req.file);
    res.json(result);

    // Delete the uploaded image file
    fs.unlinkSync(req.file.path);
  } catch (error) {
    console.error('Error during /upload:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    const generatedImages = await generateImages(prompt);
    res.json({ image_urls: generatedImages });
  } catch (error) {
    console.error('Error during /generate:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imagePath = await uploadToCloudinary(req.file.path);
    const output = await processImage(imagePath);
    res.json({ output: output });
  } catch (error) {
    console.error('Error in /process-image:', error);
    res.status(500).json({ error: `An error occurred while processing the image: ${error.message}` });
  } finally {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
  }
});


app.post('/process-image-flush-lush', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    const model = 'salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746';

    // Get breed information
    const breedInput = {
      image: `data:image/${req.file.mimetype};base64,${base64Image}`,
      task: 'visual_question_answering',
      question: 'What breed is the animal?'
    };
    const breedOutput = await replicate.run(model, { input: breedInput });
    const animalBreed = extractAnswer(breedOutput);

    // Get description (color and size)
    const descriptionInput = {
      image: `data:image/${req.file.mimetype};base64,${base64Image}`,
      task: 'image_captioning',
      question: 'What are the colors and size of the animal in the picture?'
    };
    const descriptionOutput = await replicate.run(model, { input: descriptionInput });
    const animalDescription = extractAnswer(descriptionOutput);

    const initialPrompt = `A happy ${animalBreed} that is ${animalDescription} TOK BSstyle004`;

    const result = {
      prompt: initialPrompt,
      animal_breed: animalBreed,
      animal_description: animalDescription
    };

    res.json(result);

    // Delete the uploaded image file
    fs.unlinkSync(req.file.path);
  } catch (error) {
    console.error('Error in /process-image-flush-lush:', error);
    res.status(500).json({ error: `An error occurred while processing the image: ${error.message}` });
  }
});

function extractAnswer(output) {
  let answer;
  if (typeof output === 'string') {
    answer = output.replace('Answer: ', '').trim();
  } else if (Array.isArray(output) && output.length > 0) {
    answer = output[0].replace('Answer: ', '').trim();
  } else {
    answer = 'Unknown';
  }
  
  // Remove "Caption: " if present
  return answer.replace(/^Caption:\s*/i, '');
}

// New route for generating images for Flush and Lush
app.post('/generate-images-flush-lush', async (req, res) => {
  try {
    const { prompt } = req.body;

    const input = {
      prompt: prompt,
      output_quality: 80,
      extra_lora_scale: 0.8
    };

    const output = await replicate.run(
      "bingbangboom-lab/flux-dreamscape:b761fa16918356ee07f31fad9b0d41d8919b9ff08f999e2d298a5a35b672f47e",
      { input }
    );

    res.json({ output: output });
  } catch (error) {
    console.error('Error in /generate-images-flush-lush:', error);
    res.status(500).json({ error: `An error occurred while generating images: ${error.message}` });
  }
});

app.post('/create-checkout-session', createCheckoutSession);
app.get('/verify-payment', verifyPayment);
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), handleWebhook);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});