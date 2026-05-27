// Change this for LOCAL or PROD automatically
const API_URL =
    window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://ai-blog-website-x7w3.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    checkUserProfile();
    showSavedBlogs();

    const modal = document.getElementById("blogModal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }
});

/* ================= GENERATE BLOG ================= */

async function generateBlog() {
    const topic = document.getElementById("topic").value.trim();
    const imageInput = document.getElementById("blogImage").files[0];
    const imageSource = document.getElementById("imageSource")?.value || "manual";

    if (!topic) return alert("Enter a topic!");

    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("imageSource", imageSource);

    if (imageSource === "manual" && imageInput) {
        formData.append("image", imageInput);
    }

    const blogOutput = document.getElementById("blogOutput");
    blogOutput.innerHTML = "<p>Generating blog...</p>";

    try {
        const response = await fetch(`${API_URL}/generate-blog`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || "Request failed");
        }

        const imgSrc = data.imageUrl
            ? data.imageUrl.startsWith("http")
                ? data.imageUrl
                : `${API_URL}${data.imageUrl}`
            : "";

        blogOutput.innerHTML = `
            <div class="blog-post">
                <h3 class="blog-title">${data.title}</h3>
                ${imgSrc ? `<img src="${imgSrc}" class="blog-image">` : ""}
                <div class="blog-content">${marked.parse(data.content)}</div>
            </div>
        `;

        showSavedBlogs();

    } catch (error) {
        console.error(error);
        blogOutput.innerHTML = "<p>Failed to generate blog.</p>";
    }
}

/* ================= SHOW BLOGS ================= */

async function showSavedBlogs() {
    const blogContainer = document.getElementById("savedBlogs");
    if (!blogContainer) return;

    try {
        const response = await fetch(`${API_URL}/blogs`);
        const blogs = await response.json();

        blogContainer.innerHTML =
            blogs.length === 0 ? "<p>No blogs available.</p>" : "";

        blogs.forEach((blog) => {
            const imgSrc = blog.imageUrl
                ? blog.imageUrl.startsWith("http")
                    ? blog.imageUrl
                    : `${API_URL}${blog.imageUrl}`
                : "";

            const shortContent = marked
                .parse(blog.content)
                .replace(/<[^>]+>/g, "")
                .substring(0, 150);

            const div = document.createElement("div");
            div.className = "blog-post";

            div.innerHTML = `
                <h3 class="blog-title">${blog.title}</h3>
                ${imgSrc ? `<img src="${imgSrc}" class="blog-image">` : ""}
                <p class="blog-content">${shortContent}...</p>
                <a href="${API_URL}/blog/${blog.slug}" class="read-more">Read More</a>
            `;

            blogContainer.appendChild(div);
        });

    } catch (error) {
        console.error(error);
        blogContainer.innerHTML = "<p>Failed to load blogs.</p>";
    }
}

/* ================= MODAL ================= */

async function openModal(index) {
    try {
        const res = await fetch(`${API_URL}/blogs`);
        const blogs = await res.json();

        const blog = blogs[index];
        if (!blog) return;

        document.getElementById("modalTitle").innerText = blog.title;
        document.getElementById("modalContent").innerHTML =
            marked.parse(blog.content);

        const modalImage = document.getElementById("modalImage");

        if (blog.imageUrl) {
            modalImage.src = blog.imageUrl.startsWith("http")
                ? blog.imageUrl
                : `${API_URL}${blog.imageUrl}`;

            modalImage.style.display = "block";
        } else {
            modalImage.style.display = "none";
        }

        document.getElementById("blogModal").style.display = "flex";

    } catch (err) {
        console.error(err);
    }
}

function closeModal() {
    document.getElementById("blogModal").style.display = "none";
}

/* ================= SEARCH ================= */

function searchBlogs() {
    const query = document
        .getElementById("searchBar")
        .value.toLowerCase();

    document.querySelectorAll(".blog-post").forEach((post) => {
        const title = post
            .querySelector("h3")
            .innerText.toLowerCase();

        post.style.display =
            title.includes(query) ? "block" : "none";
    });
}

/* ================= AUTH ================= */

async function checkUserProfile() {
    try {
        const res = await fetch(`${API_URL}/api/me`, {
            credentials: "include"
        });

        const data = await res.json();

        const profileSection =
            document.getElementById("profileSection");

        if (data.loggedIn) {
            profileSection.innerHTML = `
                Welcome, ${data.name} |
                <a href="/profile.html">Profile</a> |
                <a href="#" onclick="logoutUser()">Logout</a>
            `;
        } else {
            profileSection.innerHTML = `
                <a href="/login.html">Login</a> |
                <a href="/register.html">Register</a>
            `;
        }

    } catch (err) {
        console.error(err);
    }
}

async function logoutUser() {
    try {
        await fetch(`${API_URL}/api/logout`, {
            method: "POST",
            credentials: "include"
        });

        window.location.reload();
    } catch (err) {
        console.error(err);
    }
}
