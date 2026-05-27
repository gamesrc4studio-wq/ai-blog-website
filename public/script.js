const API_URL =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://ai-blog-website-x7w3.onrender.com";

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
    showSavedBlogs();
});

/* ================= GENERATE BLOG ================= */
async function generateBlog() {
    const topic = document.getElementById("topic").value.trim();
    const imageInput = document.getElementById("blogImage").files[0];
    const imageSource = document.getElementById("imageSource")?.value || "manual";

    if (!topic) return alert("Enter topic");

    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("imageSource", imageSource);

    if (imageSource === "manual" && imageInput) {
        formData.append("image", imageInput);
    }

    const output = document.getElementById("blogOutput");
    output.innerHTML = "Generating...";

    try {
        const res = await fetch(`${API_URL}/generate-blog`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        output.innerHTML = `
            <h2>${data.title}</h2>
            ${data.imageUrl ? `<img src="${API_URL}${data.imageUrl}" style="width:100%">` : ""}
            <div>${marked.parse(data.content)}</div>
        `;

        showSavedBlogs();

    } catch (err) {
        output.innerHTML = "Error generating blog";
        console.log(err);
    }
}

/* ================= SHOW BLOGS ================= */
async function showSavedBlogs() {
    const container = document.getElementById("savedBlogs");

    try {
        const res = await fetch(`${API_URL}/blogs`);
        const blogs = await res.json();

        container.innerHTML = "";

        blogs.forEach(blog => {
            const div = document.createElement("div");

            div.innerHTML = `
                <h3>${blog.title}</h3>
                ${blog.imageUrl ? `<img src="${API_URL}${blog.imageUrl}" style="width:200px">` : ""}
                <p>${blog.content.slice(0, 120)}...</p>
                <a href="${API_URL}/blog/${blog.slug}">Read</a>
            `;

            container.appendChild(div);
        });

    } catch (err) {
        console.log(err);
    }
}
