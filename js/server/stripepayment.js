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
      success_url: `https://petglamappai.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: 'https://petglamappai.com/payment-error.html',
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

    // If the session is already processed, retrieve the token and redirect
    const sessionResult = await db.query(
      'SELECT processed, token FROM payment_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length > 0 && sessionResult.rows[0].processed) {
      console.log('Session already processed.');
      const existingToken = sessionResult.rows[0].token;
      return res.redirect(`/flushandlush.html?token=${existingToken}`);
    }

    // If the payment was successful
    if (session.payment_status === 'paid') {
      console.log('Payment was successful for session:', sessionId);

      // Generate a new token
      const token = uuidv4(); // Moved the token generation here
      console.log('Generated token:', token);

      // Insert or update the user in the database
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
        return res.status(500).send('Error inserting/updating user');
      }

      // Update the payment session with the new token and set it as processed
      try {
        await db.query(
          'UPDATE payment_sessions SET token = $1, processed = true WHERE session_id = $2',
          [token, sessionId]
        );
        console.log('Payment session updated in database.');
      } catch (dbError) {
        console.error('Error updating payment session:', dbError);
        return res.status(500).send('Error updating payment session');
      }

      // Redirect to the success page with the token
      return res.redirect(`/flushandlush.html?token=${token}`);
    } else {
      console.log('Payment not successful for session:', sessionId);
      return res.redirect('/payment-error.html');
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
    return res.redirect('/payment-error.html');
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
