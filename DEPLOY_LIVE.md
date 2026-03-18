# 🚀 Live Deploy করার সহজ উপায় (3 মিনিট)

## Method 1: Cloudflare Dashboard দিয়ে (সবচেয়ে সহজ)

### Step 1: Cloudflare এ লগইন করুন
https://dash.cloudflare.com

### Step 2: Pages এ যান
**বাম পাশ মেনু → Workers & Pages → Pages**

### Step 3: "Create a project" ক্লিক করুন
- **"Connect to Git"** সিলেক্ট করুন
- **GitHub authorize** করুন
- রিপো খুঁজুন: `cp-Public-Library`
- **Connect** ক্লিক করুন

### Step 4: Build Settings সেট করুন
```
Framework preset:       None
Build command:          npm run build
Build output directory: dist
```

### Step 5: Environment Variables সেট করুন
```
CLOUDFLARE_ACCOUNT_ID=0aa3a7240be2b718a369f43f91e200b9
```

### Step 6: Deploy ক্লিক করুন ✅

**Live হবে এখানে:**
```
https://cppl.pages.dev/
```

---

## Method 2: Terminal দিয়ে (Alternative)

```bash
cd "d:\RONY\OneDrive - NRDS\CodeX\CX- Public Library"

# নিশ্চিত করুন build আছে
npx wrangler pages publish dist --project-name=cppl

# অথবা direct Pages তে publish করুন
npx wrangler pages publish \
  --account-id 0aa3a7240be2b718a369f43f91e200b9 \
  --project-name cx-public-library-pages \
  dist
```

---

## যদি এখনও সমস্যা হয়?

আমি একটি **standalone build** তৈরি করে দিচ্ছি যা Cloudflare Pages এ directly deploy হবে।

আপনি কোনটি করবেন?
1. **Cloudflare Dashboard দিয়ে** (সবচেয়ে সহজ)
2. **আমি terminal দিয়ে করব**
3. **Custom standalone build তৈরি করব**

বলুন! ⏰
