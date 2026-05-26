
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const marked = require("marked");
require("dotenv").config()
const app = express();


const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || "https://ai-blog-website-x7w3.onrender.com";

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY
const PEXELS_API_KEY = process.env.PEXELS_API_KEY
const BLOG_FILE = "blogs.json";


app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

/* Uploads  */
(async () => {
    try { await fs.mkdir("uploads"); } catch {}
})();


const storage = multer.diskStorage({
    destination: "uploads",
    filename: (_, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });


const loadBlogs = async () => {
    try {
        return JSON.parse(await fs.readFile(BLOG_FILE, "utf8"));
    } catch {
        return [];
    }
};

const saveBlogs = async (blogs) => {
    await fs.writeFile(BLOG_FILE, JSON.stringify(blogs, null, 2));
};

const slugify = (text) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const seo = (title, content) => ({
    slug: slugify(title),
    metaTitle: `${title} | Complete Guide`,
    metaDescription: content.replace(/[#*_]/g, "").slice(0, 150),
    keywords: title.toLowerCase().split(" ").join(", ")
});
/* text generator*/
async function generateBlogText(topic) {
    const res = await axios.post(
        "https://router.huggingface.co/v1/chat/completions",
        {
            model: "openai/gpt-oss-20b:fireworks-ai",
            messages: [
                {
                    role: "user",
                    content: `Write a 900-word detailed human-like SEO blog on "${topic}" with headings and subheadings use less emoji make it human like remove ai feel from it .`
                }
            ]
        },
        {
            headers: {
                Authorization: `Bearer ${HF_API_KEY}`,
                "Content-Type": "application/json"
            }
        }
    );

    return res.data.choices[0].message.content;
}

/*image generator*/
async function generateAIImage(prompt) {
    try {
        console.log("Generating AI image...");

        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 200000
        });

        const fileName = `${Date.now()}-ai.png`;
        const filePath = path.join("uploads", fileName);

        await fs.writeFile(filePath, response.data);

        console.log("AI Image Generated");
        return `/uploads/${fileName}`;

    } catch (error) {
        console.error("AI Image Error:", error.message);
        return null;
    }
}

/*PEXELS FALLBACK*/
async function fetchStockImage(topic) {
    try {
        const res = await axios.get(
            "https://api.pexels.com/v1/search",
            {
                headers: { Authorization: PEXELS_API_KEY },
                params: { query: topic, per_page: 1 }
            }
        );

        return res.data.photos?.[0]?.src?.large || null;

    } catch {
        return null;
    }
}

/* ================= GENERATE BLOG ================= */
app.post("/generate-blog", upload.single("image"), async (req, res) => {
    const { topic, imageSource } = req.body;

    if (!topic)
        return res.status(400).json({ error: "Topic required" });

    try {
        const content = await generateBlogText(topic);

        let imageUrl = null;

        if (imageSource === "manual" && req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        } else {
            imageUrl = await generateAIImage(topic);

            if (!imageUrl) {
                console.log("Falling back to Pexels...");
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
        blogs.push(blog);
        await saveBlogs(blogs);

        res.json(blog);

    } catch (error) {
        console.error("Blog generation failed:", error.message);
        res.status(500).json({ error: "Blog generation failed" });
    }
});

/* ================= GET BLOGS ================= */
app.get("/blogs", async (_, res) => {
    res.json(await loadBlogs());
});

/* ================= READ BLOG ================= */
app.get("/blog/:slug", async (req, res) => {
    const blogs = await loadBlogs();
    const blog = blogs.find(b => b.slug === req.params.slug);

    if (!blog) return res.status(404).send("Not found");

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
<title>${blog.metaTitle}</title>
<meta name="description" content="${blog.metaDescription}">
<link rel="stylesheet" href="public/style.css">
</head>
<body style="font-family:Arial;max-width:800px;margin:auto;padding:20px">
<a href="/">← Back</a>
<h1>${blog.title}</h1>
${image ? `<img src="${image}" style="width:100%;border-radius:12px">` : ""}
${marked.parse(blog.content)}
</body>
</html>
`);
});

/* ================= STATIC ================= */
app.get("/", (_, res) =>
    res.sendFile(path.join(__dirname, "public/index.html"))
);

app.listen(PORT, () => {
    console.log(`Server running at ${BASE_URL}`);
});
