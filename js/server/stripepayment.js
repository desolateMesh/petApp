// stripepayments.js

import Stripe from 'stripe';

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
    price: 50,
    successPath: '/flushandlush.html',
  },
  '3d-figure': {
    name: '3D Figure',
    description: 'A 3D printed model of your dog.',
    price: 2000,
    successPath: '/3dfiguregeneration.html',
  },
  'realistic': {
    name: 'Realistic',
    description: 'A realistic portrait of your dog.',
    price: 2000,
    successPath: '/realistic.html',
  },
};

export async function createCheckoutSession(req, res) {
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
      success_url: `http://localhost:3003${selectedStyle.successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: 'http://localhost:3003/cancel.html',
    });

    console.log('Checkout session created:', session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating Checkout Session:', error);
    res.status(500).json({ error: 'An error occurred while creating the Checkout Session.' });
  }
}

export async function verifyPayment(req, res) {
  console.log('Entering verifyPayment function');
  const DEV_MODE = process.env.NODE_ENV === 'development';
  console.log('DEV_MODE:', DEV_MODE);

  if (DEV_MODE) {
    console.log('Development mode: Returning success');
    return res.json({ payment_status: 'paid' });
  }

  const sessionId = req.query.session_id;
  console.log('Session ID:', sessionId);

  if (!sessionId) {
    console.error('No session ID provided');
    return res.status(400).json({ error: 'No session ID provided' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('Retrieved session:', session);

    if (session.payment_status === 'paid') {
      console.log('Payment status is paid, returning success');
      res.json({ payment_status: 'paid' });
    } else {
      console.log('Payment not completed. Status:', session.payment_status);
      res.json({ payment_status: session.payment_status });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'An error occurred while verifying the payment.' });
  }
}

export function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment was successful!', session);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
}