import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const widgets = new Map();
const submissions = new Map();

// Seed Demo Widget
widgets.set('wid_xyz789', {
  id: 'wid_xyz789',
  tenantId: 'tenant_abc123',
  type: 'signup',
  title: 'Join Our Newsletter',
  buttonText: 'Subscribe Now',
  fields: ['email', 'name']
});

const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions from this IP, please try again later.' }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/widgets/:id/config', (req, res) => {
  const widget = widgets.get(req.params.id);
  if (!widget) return res.status(404).json({ error: 'Widget not found' });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(widget);
});

app.get('/widget.js', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    (function() {
      const scriptTag = document.currentScript;
      const widgetId = scriptTag ? scriptTag.getAttribute('data-widget-id') : null;
      if (!widgetId) return;

      fetch('http://localhost:3000/api/widgets/' + widgetId + '/config')
        .then(res => res.json())
        .then(config => {
          const container = document.getElementById('flyrank-widget-root') || document.body;
          const wrapper = document.createElement('div');
          wrapper.innerHTML = \`
            <div style="border: 1px solid #ccc; padding: 16px; border-radius: 8px; font-family: sans-serif; max-width: 300px; background: #fff;">
              <h3>\${config.title}</h3>
              <form id="flyrank-form">
                <input type="text" name="name" placeholder="Your Name" required style="display:block; width:100%; margin-bottom:8px; padding:6px;" />
                <input type="email" name="email" placeholder="Your Email" required style="display:block; width:100%; margin-bottom:8px; padding:6px;" />
                <input type="text" name="hp_field" style="display:none;" tabindex="-1" autocomplete="off" />
                <button type="submit" style="background:#000; color:#fff; padding:8px 12px; border:none; border-radius:4px; cursor:pointer;">\${config.buttonText}</button>
              </form>
              <p id="flyrank-msg" style="font-size:12px; margin-top:8px;"></p>
            </div>
          \`;
          container.appendChild(wrapper);

          document.getElementById('flyrank-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            fetch('http://localhost:3000/api/submissions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                widgetId: widgetId,
                name: formData.get('name'),
                email: formData.get('email'),
                hp_field: formData.get('hp_field')
              })
            })
            .then(r => r.json().then(body => ({ status: r.status, body })))
            .then(resObj => {
              const msg = document.getElementById('flyrank-msg');
              if (resObj.status === 201) {
                msg.style.color = 'green';
                msg.textContent = 'Success! Thank you.';
                e.target.reset();
              } else {
                msg.style.color = 'red';
                msg.textContent = resObj.body.error || 'Failed.';
              }
            });
          });
        });
    })();
  `);
});

const submissionSchema = z.object({
  widgetId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  hp_field: z.string().optional()
});

async function fetchGeoData(ip) {
  try {
    const resA = await fetch(`http://ip-api.com/json/${ip}`);
    if (resA.ok) {
      const data = await resA.json();
      if (data.status === 'success') return { country: data.country, city: data.city, provider: 'ip-api.com' };
    }
  } catch (e) {}

  try {
    const resB = await fetch(`https://ipapi.co/${ip}/json/`);
    if (resB.ok) {
      const data = await resB.json();
      if (!data.error) return { country: data.country_name, city: data.city, provider: 'ipapi.co' };
    }
  } catch (e) {}

  return null;
}

app.post('/api/submissions', submissionLimiter, async (req, res) => {
  const result = submissionSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Validation failed', details: result.error.format() });
  }

  const { widgetId, email, name, hp_field } = result.data;
  if (!widgets.has(widgetId)) return res.status(404).json({ error: 'Widget not found' });

  if (hp_field && hp_field.trim() !== '') {
    return res.status(201).json({ success: true, message: 'Received.' });
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '8.8.8.8';
  const geoData = await fetchGeoData(clientIp.includes(':') ? '8.8.8.8' : clientIp);

  const subId = 'sub_' + Math.random().toString(36).substring(2, 9);
  submissions.set(subId, { id: subId, widgetId, payload: { email, name }, geoData, createdAt: new Date().toISOString() });

  console.log(`[SIDE-EFFECT] Submission ${subId} recorded successfully.`);
  return res.status(201).json({ success: true, id: subId, message: 'Recorded successfully.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Widget Platform API running on http://localhost:${PORT}`);
});
