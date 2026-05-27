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
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000";

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

/* ================= CREATE UPLOADS FOLDER ================= */

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

/* ================= HELPERS ================= */

const loadBlogs = async () => {
    try {
        const data = await fs.readFile(BLOG_FILE, "utf8");
        return JSON.parse(data);
    } catch {
        return [];
    }
};

const saveBlogs = async (blogs) => {
    await fs.writeFile(
        BLOG_FILE,
        JSON.stringify(blogs, null, 2)
    );
};

const slugify = (text) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const seo = (title, content) => ({
    slug: slugify(title),
    metaTitle: `${title} | Complete Guide`,
    metaDescription: content
        .replace(/[#*_]/g, "")
        .slice(0, 150),
    keywords: title.toLowerCase().split(" ").join(", ")
});

/* ================= BLOG TEXT GENERATOR ================= */

async function generateBlogText(topic) {
    try {

        console.log("Generating blog:", topic);

        const response = await axios.post(
            "https://router.huggingface.co/v1/chat/completions",
            {
                model: "google/gemma-2-2b-it",
                messages: [
                    {
                        role: "user",
                        content: `Write a detailed 900-word SEO-friendly human-like blog on "${topic}" with headings and subheadings. Make it natural and engaging.`
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

        console.log("HF SUCCESS");

        return response.data.choices[0].message.content;

    } catch (error) {

        console.log("HF ERROR STATUS:", error.response?.status);
        console.log("HF ERROR DATA:", error.response?.data);
        console.log("HF ERROR MESSAGE:", error.message);

        throw new Error("Failed to generate blog");
    }
}

/* ================= AI IMAGE ================= */

async function generateAIImage(prompt) {
    try {

        console.log("Generating AI image...");

        const imageUrl =
            `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 120000
        });

        const fileName = `${Date.now()}-ai.png`;
        const filePath = path.join("uploads", fileName);

        await fs.writeFile(filePath, response.data);

        console.log("AI IMAGE SUCCESS");

        return `/uploads/${fileName}`;

    } catch (error) {

        console.log("AI IMAGE ERROR:", error.message);

        return null;
    }
}

/* ================= PEXELS FALLBACK ================= */

async function fetchStockImage(topic) {
    try {

        console.log("Fetching Pexels image...");

        const response = await axios.get(
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

        return response.data.photos?.[0]?.src?.large || null;

    } catch (error) {

        console.log("PEXELS ERROR:", error.message);

        return null;
    }
}

/* ================= GENERATE BLOG ================= */

app.post(
    "/generate-blog",
    upload.single("image"),
    async (req, res) => {

        try {

            const { topic, imageSource } = req.body;

            if (!topic) {
                return res
                    .status(400)
                    .json({ error: "Topic required" });
            }

            const content = await generateBlogText(topic);

            let imageUrl = null;

            if (imageSource === "manual" && req.file) {

                imageUrl = `/uploads/${req.file.filename}`;

            } else {

                imageUrl = await generateAIImage(topic);

                if (!imageUrl) {

                    console.log("Using Pexels fallback");

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

        } catch (error) {

            console.log("BLOG ERROR:", error.message);

            res.status(500).json({
                error: error.message || "Blog generation failed"
            });
        }
    }
);

/* ================= GET BLOGS ================= */

app.get("/blogs", async (_, res) => {

    const blogs = await loadBlogs();

    res.json(blogs);
});

/* ================= SINGLE BLOG ================= */

app.get("/blog/:slug", async (req, res) => {

    const blogs = await loadBlogs();

    const blog = blogs.find(
        (b) => b.slug === req.params.slug
    );

    if (!blog) {
        return res.status(404).send("Blog not found");
    }

    const image =
        blog.imageUrl?.startsWith("http")
            ? blog.imageUrl
            : blog.imageUrl
            ? BASE_URL + blog.imageUrl
            : "";

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${blog.metaTitle}</title>

<meta name="description" content="${blog.metaDescription}">
<meta name="keywords" content="${blog.keywords}">

<style>

body{
    font-family:Arial;
    max-width:900px;
    margin:auto;
    padding:20px;
    line-height:1.7;
    background:#f5f5f5;
    color:#111;
}

img{
    width:100%;
    border-radius:14px;
    margin:20px 0;
}

a{
    text-decoration:none;
    color:#000;
}

article{
    background:white;
    padding:25px;
    border-radius:14px;
}

</style>

</head>

<body>

<a href="/">← Back</a>

<article>

<h1>${blog.title}</h1>

${image ? `<img src="${image}" alt="${blog.title}">` : ""}

${marked.parse(blog.content)}

</article>

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
    console.log(`Server running at ${BASE_URL}`);
});
