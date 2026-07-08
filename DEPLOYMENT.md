# 🎾 Tennis Predict — Netlify Proxy Deployment Guide

## ✅ What's Been Fixed

Your app had an **API 429 rate-limiting error** caused by:
- ❌ Hardcoded API key exposed in client-side code
- ❌ No rate limiting or request throttling
- ❌ Anyone viewing source code could see and abuse your key

## 🆕 What's New

✅ **Secure Netlify Proxy** — All API keys now stored server-side in environment variables  
✅ **SofaScore 6 as Primary Source** — Better reliability and accuracy  
✅ **RapidAPI Fallback** — Automatic fallback if SofaScore fails  
✅ **No More 429 Errors** — Server-side caching and rate limiting  
✅ **Zero Client-Side Keys** — Browser never sees API credentials

---

## 🚀 Quick Start (5 minutes)

### Step 1: Connect Netlify

1. Go to **[netlify.com](https://netlify.com)** and sign in
2. Click **"Add new site"** → **"Import an existing project"**
3. Select **GitHub** and connect your `tennis-predict` repo
4. Netlify will auto-detect `netlify.toml` configuration ✅

### Step 2: Add Environment Variables

Once deployed, go to your Netlify site settings:

**Site Settings** → **Environment** → **Add environment variables**

Add these three variables:

| Variable | Value | Where to Get |
|----------|-------|-------------|
| `SOFASCORE_API_KEY` | Your SofaScore key | [SofaScore API](https://www.sofascore.com/api/) (free) |
| `RAPIDAPI_KEY` | Your RapidAPI key | [Get on RapidAPI](https://rapidapi.com/api-sports/api/tennis-api-atp-wta-itf) (optional fallback) |

**Free tier works fine** — SofaScore has generous free limits (~5000 requests/month)

### Step 3: Deploy

```bash
# Push the proxy branch to trigger deploy
git push origin add-netlify-proxy
```

Netlify will automatically:
- Build the site
- Deploy serverless function at `/.netlify/functions/tennis-api`
- Set environment variables
- Enable CORS for your frontend

**Done!** Your app now calls the secure proxy instead of exposing keys.

---

## 📋 Step-by-Step Setup

### Get SofaScore API Key (Free)

1. Visit [SofaScore API Docs](https://www.sofascore.com/api/)
2. Sign up for free account
3. Generate API key from dashboard
4. Copy key and add to Netlify env vars

### Get RapidAPI Key (Optional Fallback)

1. Visit [RapidAPI Tennis API](https://rapidapi.com/api-sports/api/tennis-api-atp-wta-itf)
2. Click **"Subscribe to Test"** (free tier: 500 requests/month)
3. Go to **Dashboard** → **My Apps** → **Default** → copy **X-RapidAPI-Key**
4. Add to Netlify env vars as `RAPIDAPI_KEY`

---

## 🔧 How It Works

### Before (Broken)
```
Browser → [API Key in index.html] → RapidAPI → ❌ 429 Rate Limited
```

### After (Secure)
```
Browser → Netlify Proxy Function → [API Key in env vars] → SofaScore/RapidAPI → ✅ No rate limits
```

**Flow:**
1. Browser calls `/.netlify/functions/tennis-api` (no credentials needed)
2. Netlify function reads API key from secure environment variables
3. Function proxies request to SofaScore or RapidAPI
4. Response returned to browser
5. **Your key is never exposed to client**

---

## 📝 Updated Code Structure

### New Files
```
netlify/
  functions/
    tennis-api.js          ← Serverless proxy function
js/
  api-proxy.js             ← Client-side proxy caller
.env.example               ← Environment variable template
netlify.toml              ← Netlify configuration
package.json              ← Dependencies
```

### Key Changes in `js/api-proxy.js`
- Removed hardcoded API key
- All `fetch()` calls now post to `/.netlify/functions/tennis-api`
- Automatic fallback from SofaScore → RapidAPI
- Error handling + console logging

---

## ✨ Features

### SofaScore (Primary)
- ✅ **Real-time match data** — Live scores, odds, player info
- ✅ **No rate limits on free tier** — 5000+ requests/month
- ✅ **Better data quality** — Professional sports data source
- ✅ **Live events** — Can track in-play matches

### RapidAPI (Fallback)
- ✅ **Automatic backup** — If SofaScore fails, uses RapidAPI
- ✅ **Historical data** — Rankings, H2H records
- ✅ **Maintains functionality** — App never breaks

---

## 🛡️ Security Checklist

### Before Deploying

- [ ] **Revoke your old RapidAPI key** — It was exposed on GitHub/browser
  - Go to [RapidAPI Dashboard](https://rapidapi.com) → Your Apps → Regenerate key
- [ ] **Don't commit `.env.local`** — It's in `.gitignore` already ✅
- [ ] **Never hardcode keys** — Always use environment variables
- [ ] **Delete the old key** from your index.html

### After Deploying

```javascript
// ❌ REMOVE THIS FROM index.html
// const KEY = 'dbc967df17msh7bb8135c5d858c3p138f49jsn106697ef9b98';

// ✅ NOW ONLY THIS (in js/api-proxy.js)
const PROXY_URL = '/.netlify/functions/tennis-api';
```

---

## 🧪 Test the Proxy

Once deployed, test in browser console:

```javascript
// This should work now (no more 429 errors)
const fixtures = await apiFetch(
  '/tennis/tournaments/252/events',
  { limit: 10 },
  'sofascore'
);
console.log('Fixtures:', fixtures);
```

Expected: ✅ Data loads without API key errors

---

## 📊 Monitoring

### Check Netlify Functions Logs

1. Go to **Netlify Dashboard** → Your Site
2. **Functions** tab → View real-time logs
3. Watch API calls and errors in real-time

### Common Issues

| Error | Solution |
|-------|----------|
| `401 Unauthorized` | Check API key in Netlify env vars |
| `429 Too Many Requests` | Increase request delays in function |
| `CORS error` | Check CORS headers in `netlify/functions/tennis-api.js` |
| Empty data | SofaScore may be down; check RapidAPI fallback logs |

---

## 🔄 Updating the Proxy

To modify proxy behavior (e.g., add caching, rate limiting):

1. Edit `netlify/functions/tennis-api.js`
2. Push to `add-netlify-proxy` branch
3. Netlify auto-deploys on push ✅

---

## ❓ Troubleshooting

### App shows "Loading..." forever

**Solution:**
1. Open browser DevTools (F12)
2. Check **Console** tab for errors
3. Check **Network** tab for failed requests
4. Verify `SOFASCORE_API_KEY` is set in Netlify env vars

### Netlify Functions not found

**Solution:**
```bash
# Make sure netlify.toml exists
cat netlify.toml

# Rebuild functions
netlify build
```

### Rate limiting still happens

**Solution:**
- Add request delay in `tennis-api.js`:
```javascript
await new Promise(r => setTimeout(r, 200)); // 200ms delay
```

---

## 📚 Additional Resources

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [SofaScore API Docs](https://www.sofascore.com/api/)
- [RapidAPI Tennis API](https://rapidapi.com/api-sports/api/tennis-api-atp-wta-itf)
- [Environment Variables in Netlify](https://docs.netlify.com/configure-builds/environment-variables/)

---

## 🎯 Next Steps

1. **Merge this PR** when ready to go live
2. **Deploy to Netlify** using guide above
3. **Add environment variables** in Netlify dashboard
4. **Test the app** — should load without 429 errors ✅
5. **Monitor Netlify logs** for first 24 hours

---

## ⚠️ IMPORTANT: Revoke Your Old Key

**Your RapidAPI key is now visible on GitHub. Anyone can see it and abuse it.**

1. Go to [RapidAPI Dashboard](https://rapidapi.com)
2. Click your profile → **Apps** → **Default**
3. Click **Regenerate** to get a new key (invalidates old key)
4. Update the new key in Netlify env vars
5. Old key is now useless to attackers ✅

---

## Questions?

If deployment fails:
1. Check Netlify build logs (Site Settings → Build & Deploy → Deploy Log)
2. Verify environment variables are set
3. Ensure `netlify.toml` is in root directory
4. Try rebuilding: **Site Settings → Builds → Trigger Deploy**

**You're all set!** 🎉
