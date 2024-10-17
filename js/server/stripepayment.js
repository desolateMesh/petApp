// stripepayments.js

import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import path from 'path';
import fs from 'fs';
import db from './db.js'; // Adjust the path as necessary

// Recreate __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

let stripe;

export function configureStripe() {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-08-16',
  });
  return stripe;
}

const styles = {
  'flush-and-lush': {
    name: 'Flush & Lush',
    description: 'A plush representation of your dog.',
    price: 1500,
    successPath: '/flushandlush.html',
  },
  '3d-figure': {
    name: '3D Figure',
    description: 'A 3D printed model of your dog.',
    price: 1200,
    successPath: '/3dfiguregeneration.html',
  },
  'realistic': {
    name: 'Realistic',
    description: 'A realistic portrait of your dog.',
    price: 1000,
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
      success_url: 'http://localhost:3003/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:3003/payment-error.html',
      metadata: {
        style,
      },
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
    console.log('Session retrieved:', session);

    if (session.payment_status === 'paid') {
      console.log('Payment was successful for session:', sessionId);
      console.log('Session customer details:', session.customer_details);

      // Store user information
      let userId;
      try {
        console.log('Attempting to insert/update user with email:', session.customer_details.email);

        const userResult = await db.query(
          `INSERT INTO users (username, email)
           VALUES ($1, $2)
           ON CONFLICT (email) DO UPDATE
           SET username = EXCLUDED.username
           RETURNING id`,
          [session.customer_details.name, session.customer_details.email]
        );
        userId = userResult.rows[0].id;
        console.log('User inserted/updated with ID:', userId);
      } catch (dbError) {
        console.error('Error inserting/updating user:', dbError);

        // If insert/update fails, try to fetch the user by email
        const userResult = await db.query(
          'SELECT id FROM users WHERE email = $1',
          [session.customer_details.email]
        );
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log('User found with ID:', userId);
        } else {
          throw new Error('Unable to insert or retrieve user');
        }
      }

      // Generate token
      const token = uuidv4();
      console.log('Generated token:', token);

      // Store token in database
      await db.query(
        'INSERT INTO tokens (user_id, token, used) VALUES ($1, $2, $3)',
        [userId, token, false]
      );
      console.log('Token stored in database for user:', userId);

      // Store token in session
      req.session.token = token;
      console.log('Token stored in session');

      // Update payment session with user ID
      await db.query(
        'UPDATE payment_sessions SET user_id = $1 WHERE session_id = $2',
        [userId, sessionId]
      );
      console.log('Payment session updated with user ID:', userId);

      // Define selectedStyle
      const style = session.metadata.style || 'flush-and-lush';
      const selectedStyle = styles[style];

      if (!selectedStyle) {
        console.error(`Invalid style: ${style}`);
        return res.status(400).send('Invalid style selected.');
      }

      console.log('Redirecting to style page:', selectedStyle.successPath);
      res.redirect(selectedStyle.successPath);
    } else {
      console.log('Payment not successful for session:', sessionId);
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
        `INSERT INTO users (username, email)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE
         SET username = EXCLUDED.username
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
