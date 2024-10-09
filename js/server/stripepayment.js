// stripepayments.js

import { v4 as uuidv4 } from 'uuid'; // Import uuidv4
import db from './db.js'; // Ensure this path is correct
import dotenv from 'dotenv';
import Stripe from 'stripe';

dotenv.config();

let stripe;

export function configureStripe() {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY_TEST, {
    apiVersion: '2023-08-16',
  });
  return stripe;
}

const styles = {
  'flush-and-lush': {
    name: 'Flush & Lush',
    description: 'A plush representation of your dog.',
    price: 599,
    successPath: '/flushandlush.html',
  },
  '3d-figure': {
    name: '3D Figure',
    description: 'A 3D printed model of your dog.',
    price: 899,
    successPath: '/3dfiguregeneration.html',
  },
  'realistic': {
    name: 'Realistic',
    description: 'A realistic portrait of your dog.',
    price: 499,
    successPath: '/realistic.html',
  },
};

async function createCheckoutSession(req, res) {
  try {
    const { style } = req.body;
    const selectedStyle = styles[style];

    if (!selectedStyle) {
      return res.status(400).json({ error: 'Invalid style selected.' });
    }

    console.log('Creating checkout session for style:', style);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: selectedStyle.name,
            description: selectedStyle.description,
          },
          unit_amount: selectedStyle.price,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `http://localhost:3003/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: 'http://localhost:3003/cancel.html',
    });

    console.log('Checkout session created:', session.id);

    // Store session ID for later use
    await db.query('INSERT INTO payment_sessions (session_id, isgenerated) VALUES ($1, $2)', [session.id, false]);

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating Checkout Session:', error);
    res.status(500).json({ error: 'An error occurred while creating the Checkout Session.' });
  }
}

async function handlePaymentSuccess(req, res) {
  const sessionId = req.query.session_id;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Store user information
      let userId;
      try {
        const userResult = await db.query(
          `INSERT INTO users (username, email) 
           VALUES ($1, $2) 
           ON CONFLICT (email) DO UPDATE 
           SET username = EXCLUDED.username 
           RETURNING id`,
          [session.customer_details.name, session.customer_details.email]
        );
        userId = userResult.rows[0].id;
      } catch (dbError) {
        console.error('Error inserting/updating user:', dbError);
        // If insert/update fails, try to fetch the user by email
        const userResult = await db.query(
          'SELECT id FROM users WHERE email = $1',
          [session.customer_details.email]
        );
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
        } else {
          throw new Error('Unable to insert or retrieve user');
        }
      }

      // Generate token
      const token = uuidv4();

      // Store token in database
      await db.query(
        'INSERT INTO tokens (user_id, token, used) VALUES ($1, $2, $3)',
        [userId, token, false]
      );

      // Store token in session
      req.session.token = token;

      // Update payment session with user ID
      await db.query(
        'UPDATE payment_sessions SET user_id = $1 WHERE session_id = $2',
        [userId, sessionId]
      );

      console.log('User information stored, token generated, and payment session updated');

      // Redirect to the appropriate HTML page based on the style
      const style = session.metadata.style || 'flushandlush'; // Default to 'flush-and-lush' if style is not set
      res.redirect(`/${style}.html?session_id=${sessionId}`);
    } else {
      res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
    res.status(500).json({ error: 'An error occurred while processing the payment.' });
  }
}

async function handleWebhook(req, res) {
  console.log('Webhook received');
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Event constructed successfully:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment was successful! Session details:', JSON.stringify(session, null, 2));

    try {
      // Insert user data
      const userResult = await db.query(
        `INSERT INTO users (name, email)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name
         RETURNING id`,
        [
          session.customer_details.name,
          session.customer_details.email
        ]
      );
      
      console.log('User data inserted/updated. Result:', userResult.rows[0]);

      const userId = userResult.rows[0].id;

      // Insert payment session
      const sessionResult = await db.query(
        'INSERT INTO payment_sessions (session_id, user_id, isgenerated) VALUES ($1, $2, $3) RETURNING *',
        [session.id, userId, false]
      );

      console.log('Payment session inserted. Result:', sessionResult.rows[0]);
    } catch (err) {
      console.error('Error in database operations:', err);
    }
  } else {
    console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
}

export { createCheckoutSession, handlePaymentSuccess, handleWebhook };
