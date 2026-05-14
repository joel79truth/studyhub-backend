const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));
app.use(express.json());

// Rate limiting to prevent abuse
const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per window
  message: { error: 'Too many access requests, please try again later' }
});

// Supabase client with SERVICE ROLE key (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ==================== ENDPOINT: Check paper access & return signed URL ====================
app.post('/paper/access', accessLimiter, async (req, res) => {
  try {
    const { paperId, email } = req.body;

    if (!paperId) {
      return res.status(400).json({ error: 'paperId is required' });
    }

    // 1. Fetch paper details
    const { data: paper, error: paperError } = await supabase
      .from('past_papers')
      .select('*')
      .eq('id', paperId)
      .single();

    if (paperError || !paper) {
      console.error('Paper fetch error:', paperError);
      return res.status(404).json({ error: 'Paper not found' });
    }

    // 2. If paper is paid, verify purchase
    if (paper.is_paid && paper.price > 0) {
      if (!email) {
        return res.status(401).json({ error: 'Login required to access paid content' });
      }

      // Check if purchase exists and is paid
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('*')
        .eq('paper_id', paperId)
        .eq('user_email', email)
        .eq('status', 'paid')
        .maybeSingle();

      if (purchaseError) {
        console.error('Purchase check error:', purchaseError);
        return res.status(500).json({ error: 'Error verifying purchase' });
      }

      if (!purchase) {
        return res.status(403).json({ error: 'payment_required' });
      }
    }

    // 3. Generate signed URL (valid for 5 minutes = 300 seconds)
    const { data: signedUrlData, error: signError } = await supabase
      .storage
      .from('past-paper')  // Your private bucket name
      .createSignedUrl(paper.storage_path, 300);

    if (signError || !signedUrlData) {
      console.error('Signed URL error:', signError);
      return res.status(500).json({ error: 'Could not generate access link' });
    }

    // 4. Increment view count asynchronously (don't wait for response)
    supabase
      .from('past_papers')
      .update({ views: (paper.views || 0) + 1 })
      .eq('id', paperId)
      .then(() => console.log(`Views updated for paper ${paperId}`))
      .catch(err => console.error('View update failed:', err));

    // 5. Return signed URL
    res.json({
      signedUrl: signedUrlData.signedUrl,
      expiresIn: 300
    });

  } catch (err) {
    console.error('Access endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== WEBHOOK: PayChangu payment confirmation ====================
app.post('/paychangu/webhook', async (req, res) => {
  try {
    const { tx_ref, status, meta, customer } = req.body;

    console.log('Webhook received:', { tx_ref, status, meta, customer });

    // Only process successful payments
    if (status !== 'successful') {
      return res.sendStatus(200); // Acknowledge receipt, ignore
    }

    const paperId = meta?.paper_id;
    const userEmail = customer?.email;
    const transactionRef = tx_ref;

    if (!paperId || !userEmail || !transactionRef) {
      console.error('Missing webhook data:', { paperId, userEmail, transactionRef });
      return res.sendStatus(400);
    }

    // Check if already processed (idempotency)
    const { data: existing, error: checkError } = await supabase
      .from('purchases')
      .select('id')
      .eq('tx_ref', transactionRef)
      .maybeSingle();

    if (checkError) {
      console.error('Idempotency check error:', checkError);
      return res.sendStatus(500);
    }

    if (existing) {
      console.log(`Duplicate webhook ignored for tx_ref: ${transactionRef}`);
      return res.sendStatus(200);
    }

    // Insert purchase record
    const { error: insertError } = await supabase
      .from('purchases')
      .insert([{
        paper_id: paperId,
        user_email: userEmail,
        tx_ref: transactionRef,
        status: 'paid',
        purchased_at: new Date().toISOString()
      }]);

    if (insertError) {
      console.error('Purchase insert error:', insertError);
      return res.sendStatus(500);
    }

    console.log(`Purchase recorded: ${userEmail} bought paper ${paperId}`);
    res.sendStatus(200);

  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(500);
  }
});

// ==================== OPTIONAL: Verify payment status (for frontend to check) ====================
app.post('/paper/check-purchase', async (req, res) => {
  try {
    const { paperId, email } = req.body;
    if (!paperId || !email) {
      return res.status(400).json({ error: 'paperId and email required' });
    }

    const { data: purchase, error } = await supabase
      .from('purchases')
      .select('status')
      .eq('paper_id', paperId)
      .eq('user_email', email)
      .eq('status', 'paid')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ purchased: !!purchase });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`🌐 Allowed frontend origin: ${process.env.FRONTEND_URL || 'http://localhost:5500'}`);
});