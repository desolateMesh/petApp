// server.js

import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bodyParser from 'body-parser';
import db from './db.js';
import { configureCloudinary, uploadToCloudinary } from './cloudinary.js';
import { processImage, generateImages, generateRealisticImage} from '../server/imageProcessing.js';
import { configureStripe, createCheckoutSession, handlePaymentSuccess, handleWebhook } from './stripepayment.js';

import Replicate from 'replicate';

configureStripe();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3003;

// Initialize the Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Middleware
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));
app.use(express.json({ limit: '20mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'someSecretKey',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Set to false during development if not using HTTPS
    httpOnly: true, // Prevent JavaScript from accessing the cookie
    sameSite: 'lax', // Allow the cookie to be sent more easily between different pages
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// New route for token validation
app.get('/validate-token', async (req, res) => {
  console.log('Session token:', req.session.token);
  const sessionToken = req.session.token;
  if (!sessionToken) {
    return res.status(401).json({ error: 'No token found in session' });
  }

  try {
    const result = await db.query('SELECT * FROM tokens WHERE token = $1 AND used = FALSE', [sessionToken]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or used token' });
    }
    res.json({ valid: true });
  } catch (error) {
    console.error('Error validating token:', error);
    res.status(500).json({ error: 'An error occurred while validating the token' });
  }
});

// Serve flushandlush.html page after payment verification
app.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;

  try {
    const storedSession = await db.query('SELECT * FROM payment_sessions WHERE session_id = $1', [sessionId]);

    if (!storedSession.rows.length) {
      return res.status(400).json({ status: 'failed', message: 'Session not found in database' });
    }

    const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

    if (session.id === storedSession.rows[0].session_id && session.payment_status === 'paid') {
      req.session.token = uuidv4();
      await db.query('INSERT INTO tokens (token, used) VALUES ($1, $2)', [req.session.token, false]);

      req.session.save((err) => {
        if (err) {
          console.error('Error saving session:', err);
          return res.status(500).json({ error: 'Failed to save session' });
        }
        res.json({ status: 'success', message: 'Payment verified', token: req.session.token });
      });
    } else {
      return res.status(400).json({ status: 'failed', message: 'Session mismatch or payment not verified' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ status: 'failed', error: error.message });
  }
});

// Serve static files
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

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Set up routes
app.post('/create-checkout-session', createCheckoutSession);
app.get('/payment-success', handlePaymentSuccess);

app.post('/webhook', handleWebhook);

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

// Updated route for image generation
app.post('/generate-images-flush-lush', async (req, res) => {
  const sessionToken = req.session.token;
  const { prompt } = req.body;

  if (!sessionToken) {
    return res.status(401).json({ error: 'No token found in session' });
  }

  try {
    const tokenResult = await db.query('SELECT * FROM tokens WHERE token = $1 AND used = FALSE', [sessionToken]);
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or used token' });
    }

    // Proceed with image generation
    const allImages = [];
    for (let i = 0; i < 1; i++) {
      const input = {
        prompt: prompt,
        output_quality: 80,
        extra_lora_scale: 0.8,
        num_outputs: 4
      };

      const output = await replicate.run(
        "bingbangboom-lab/flux-dreamscape:b761fa16918356ee07f31fad9b0d41d8919b9ff08f999e2d298a5a35b672f47e",
        { input }
      );

      allImages.push(...output);
    }

    // Mark token as used
    await db.query('UPDATE tokens SET used = TRUE WHERE token = $1', [sessionToken]);

    // Remove token from session
    delete req.session.token;

    // Return the generated images
    res.json({ output: allImages });
  } catch (error) {
    console.error('Error in /generate-images-flush-lush:', error);
    res.status(500).json({ error: `An error occurred while generating images: ${error.message}` });
  }
});

app.post('/process-image-3d-figure', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }
    const result = await processImage(req.file);
    res.json(result);
    // Delete the uploaded image file
    fs.unlinkSync(req.file.path);
  } catch (error) {
    console.error('Error during /process-image-3d-figure:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/generate-3d-figure', validateToken, async (req, res) => {
  const sessionToken = req.session.token;
  try {
    const { prompt } = req.body;
    const allImages = [];

    // Generate images (your existing code here)
    for (let i = 0; i < 1; i++) {
      const images = await generateImages(prompt);
      if (images && images.length > 0) {
        allImages.push(...images);
      } else {
        console.warn(`No images generated in iteration ${i + 1}`);
      }
    }

    if (allImages.length === 0) {
      throw new Error('Failed to generate any images');
    }

    // Mark token as used
    await db.query('UPDATE tokens SET used = TRUE WHERE token = $1', [sessionToken]);

    // Remove token from session
    delete req.session.token;

    // Save the session to ensure the token removal is persisted
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Failed to update session' });
      }

      // Return generated images
      res.json({ image_urls: allImages });
    });

  } catch (error) {
    console.error('Error during /generate-3d-figure:', error);
    res.status(500).json({ error: error.message });
  }
});

// New route for generating realistic images
app.post('/generate-realistic', upload.single('image'), async (req, res) => {
  try {
    const { prompt } = req.body;
    const imageFile = req.file;

    if (!prompt || !imageFile) {
      return res.status(400).json({ error: 'Prompt and image are required' });
    }

    // Read the image file and convert it to base64
    const imageBuffer = fs.readFileSync(imageFile.path);
    const base64Image = imageBuffer.toString('base64');

    const input = {
      prompt: prompt,
      image: `data:${imageFile.mimetype};base64,${base64Image}`,
      model: "dev",
      lora_scale: 1,
      num_outputs: 4,
      aspect_ratio: "1:1",
      output_format: "webp",
      guidance_scale: 3.5,
      output_quality: 90,
      prompt_strength: 0.8,
      extra_lora_scale: 1,
      num_inference_steps: 28
    };

    console.log('Sending request to Replicate API with input:', JSON.stringify(input, null, 2));

    const allImages = [];

    // Make 7 API calls to generate a total of 28 images
    for (let i = 0; i < 1; i++) {
      const output = await replicate.run(
        "desolatemesh/dog:0a4593380a7fbf86208b1b1dd78589d1ef892dd3a5c0fe39b62cae5b958268fb",
        { input }
      );

      console.log(`Received output ${i + 1} from Replicate API:`, JSON.stringify(output, null, 2));

      if (output && output.length > 0) {
        allImages.push(...output);
      } else {
        console.warn(`No output received from the API in run ${i + 1}`);
      }
    }

    // Delete the temporary uploaded file
    fs.unlinkSync(imageFile.path);

    if (allImages.length > 0) {
      res.json({ image_urls: allImages });
    } else {
      throw new Error('No output received from the API after multiple attempts');
    }
  } catch (error) {
    console.error('Error generating realistic images:', error);
    if (error.response) {
      console.error('API response:', error.response.data);
    }
    res.status(500).json({ error: 'An error occurred while generating the images' });
  }
});
  
  // Example route to insert data into the 'payments' table
  app.post('/add-payment', async (req, res) => {
    const { userId, paymentIntentId, amount, currency } = req.body;
  
    try {
      const queryText = `INSERT INTO payments (user_id, payment_intent_id, amount, currency)
                         VALUES ($1, $2, $3, $4) RETURNING *`;
      const result = await db.query(queryText, [userId, paymentIntentId, amount, currency]);
      res.json(result.rows[0]); // Return the inserted row
    } catch (err) {
      console.error('Error inserting payment:', err);
      res.status(500).json({ error: 'Failed to insert payment' });
    }
  });
  
  // Example route to retrieve all payments
  app.get('/payments', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM payments');
      res.json(result.rows); // Return all rows in the 'payments' table
    } catch (err) {
      console.error('Error retrieving payments:', err);
      res.status(500).json({ error: 'Failed to retrieve payments' });
    }
  });
  
  app.get('/test-db', async (req, res) => {
    try {
      const result = await db.query('SELECT NOW()'); // Query the current time
      res.json(result.rows[0]); // Return the result
    } catch (err) {
      console.error('Error connecting to database:', err);
      res.status(500).send('Database connection failed');
    }
  });
  
  // Start the server
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });