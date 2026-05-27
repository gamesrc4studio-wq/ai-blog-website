const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const marked = require("marked");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL =
    process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

const BLOG_FILE = "blogs.json";

console.log("HF KEY LOADED:", !!HF_API_KEY);
console.log("PEXELS KEY LOADED:", !!PEXELS_API_KEY);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

/* ================= UPLOAD DIR ================= */
(async () => {
    try {
        await fs.mkdir("uploads");
    } catch {}
})();

/* ================= MULTER ================= */
const storage = multer.diskStorage({
    destination: "uploads",
    filename: (_, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

/* ================= BLOG STORAGE ================= */
async function loadBlogs() {
    try {
        return JSON.parse(await fs.readFile(BLOG_FILE, "utf8"));
    } catch {
        return [];
    }
}

async function saveBlogs(blogs) {
    await fs.writeFile(BLOG_FILE, JSON.stringify(blogs, null, 2));
}

/* ================= SEO ================= */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function seo(title, content) {
    return {
        slug: slugify(title),
        metaTitle: `${title} | Guide`,
        metaDescription: content.replace(/[#*_]/g, "").slice(0, 150),
        keywords: title.toLowerCase().split(" ").join(", ")
    };
}

/* ================= AI TEXT ================= */
async function generateBlogText(topic) {
    try {
        const response = await axios.post(
            "https://router.huggingface.co/v1/chat/completions",
            {
                model: "google/gemma-2-2b-it",
                messages: [
                    {
                        role: "user",
                        content: `Write a 900-word SEO blog on "${topic}" with headings.`
                    }
                ],
                max_tokens: 1400,
                temperature: 0.7
            },
            {
                headers: {
                    Authorization: `Bearer ${HF_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 120000
            }
        );

        return response.data.choices[0].message.content;

    } catch (err) {
        console.log("HF ERROR:", err.response?.data || err.message);
        throw new Error("AI generation failed");
    }
}

/* ================= IMAGE ================= */
async function generateAIImage(prompt) {
    try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

        const res = await axios.get(url, {
            responseType: "arraybuffer"
        });

        const fileName = `${Date.now()}.png`;
        const filePath = path.join("uploads", fileName);

        await fs.writeFile(filePath, res.data);

        return `/uploads/${fileName}`;

    } catch {
        return null;
    }
}

/* ================= PEXELS ================= */
async function fetchStockImage(topic) {
    try {
        const res = await axios.get(
            "https://api.pexels.com/v1/search",
            {
                headers: {
                    Authorization: PEXELS_API_KEY
                },
                params: {
                    query: topic,
                    per_page: 1
                }
            }
        );

        return res.data.photos?.[0]?.src?.large || null;

    } catch {
        return null;
    }
}

/* ================= GENERATE BLOG ================= */
app.post("/generate-blog", upload.single("image"), async (req, res) => {
    try {
        const { topic, imageSource } = req.body;

        if (!topic) {
            return res.status(400).json({ error: "Topic required" });
        }

        const content = await generateBlogText(topic);

        let imageUrl = null;

        if (imageSource === "manual" && req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        } else {
            imageUrl = await generateAIImage(topic);

            if (!imageUrl) {
                imageUrl = await fetchStockImage(topic);
            }
        }

        const meta = seo(topic, content);

        const blog = {
            title: topic,
            content,
            imageUrl,
            ...meta,
            date: new Date().toISOString()
        };

        const blogs = await loadBlogs();
        blogs.unshift(blog);
        await saveBlogs(blogs);

        res.json(blog);

    } catch (err) {
        console.log("BLOG ERROR:", err.message);
        res.status(500).json({ error: "Blog generation failed" });
    }
});

/* ================= BLOGS ================= */
app.get("/blogs", async (_, res) => {
    res.json(await loadBlogs());
});

/* ================= BLOG PAGE ================= */
app.get("/blog/:slug", async (req, res) => {
    const blogs = await loadBlogs();
    const blog = blogs.find(b => b.slug === req.params.slug);

    if (!blog) return res.status(404).send("Not found");

    const image = blog.imageUrl?.startsWith("http")
        ? blog.imageUrl
        : blog.imageUrl
        ? BASE_URL + blog.imageUrl
        : "";

    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>${blog.metaTitle}</title>
<meta name="description" content="${blog.metaDescription}">
</head>
<body>
<h1>${blog.title}</h1>
${image ? `<img src="${image}" style="width:100%">` : ""}
${marked.parse(blog.content)}
</body>
</html>
`);
});

/* ================= HOME ================= */
app.get("/", (_, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

/* ================= START ================= */
app.listen(PORT, () => {
    console.log("Server running:", BASE_URL);
});
