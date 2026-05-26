const API_URL = "https://ai-blog-website-x7w3.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    checkUserProfile();
    showSavedBlogs();

    // Close modal when clicking outside content
    const modal = document.getElementById("blogModal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }
});

// ✅ Generate Blog
async function generateBlog() {
    const topic = document.getElementById("topic").value.trim();
    const imageInput = document.getElementById("blogImage").files[0];
    const imageSource = document.getElementById("imageSource")?.value || "manual";

    if (!topic) return alert("Enter a topic!");

    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("imageSource", imageSource);

    if (imageSource === "manual" && imageInput) formData.append("image", imageInput);

    const blogOutput = document.getElementById("blogOutput");
    blogOutput.innerHTML = "<p>Generating blog...</p>";

    try {
        const response = await fetch(`${API_URL}/generate-blog`, { method: "POST", body: formData });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        const imgSrc = data.imageUrl ? (data.imageUrl.startsWith("http") ? data.imageUrl : `${API_URL}${data.imageUrl}`) : "";
        const imageHTML = imgSrc ? `<img src="${imgSrc}" class="blog-image">` : "";

        blogOutput.innerHTML = `
            <div class="blog-post">
                <h3 class="blog-title">${data.title}</h3>
                ${imageHTML}
                <div class="blog-content">${marked.parse(data.content)}</div>
            </div>
        `;

        showSavedBlogs();
    } catch (error) {
        console.error(error);
        blogOutput.innerHTML = "<p>Failed to generate blog.</p>";
    }
}

// ✅ Fetch and Display Saved Blogs
async function showSavedBlogs() {
    const blogContainer = document.getElementById("savedBlogs");
    if (!blogContainer) return;

    try {
        const response = await fetch(`${API_URL}/blogs`);
        if (!response.ok) throw new Error("Failed to fetch blogs");

        const blogs = await response.json();
        blogContainer.innerHTML = blogs.length === 0 ? "<p>No blogs available.</p>" : "";

        blogs.forEach((blog) => {
            const imgSrc = blog.imageUrl ? (blog.imageUrl.startsWith("http") ? blog.imageUrl : `${API_URL}${blog.imageUrl}`) : "";

            // ✅ Clean preview text (remove Markdown headings and HTML tags)
            const shortContent = marked.parse(blog.content)
                .replace(/<[^>]+>/g, '') // Remove HTML tags
                .substring(0, 150); // Limit length

            const blogDiv = document.createElement("div");
            blogDiv.classList.add("blog-post");
            blogDiv.innerHTML = `
                <h3 class="blog-title">${blog.title}</h3>
                ${imgSrc ? `<img src="${imgSrc}" class="blog-image">` : ""}
                <p class="blog-content">${shortContent}...</p>
                <a href="/blog/${blog.slug}" class="read-more">Read More</a>
            `;
            blogContainer.appendChild(blogDiv);
        });
    } catch (error) {
        console.error(error);
        blogContainer.innerHTML = "<p>Failed to load blogs.</p>";
    }
}

// ✅ Open Modal (kept for future use)
async function openModal(index) {
    try {
        const response = await fetch(`${API_URL}/blogs`);
        const blogs = await response.json();
        const blog = blogs[index];
        if (!blog) return console.error("Blog not found!");

        const modal = document.getElementById("blogModal");
        document.getElementById("modalTitle").innerText = blog.title;
        document.getElementById("modalContent").innerHTML = marked.parse(blog.content);

        const modalImage = document.getElementById("modalImage");
        if (blog.imageUrl) {
            modalImage.src = blog.imageUrl.startsWith("http") ? blog.imageUrl : `${API_URL}${blog.imageUrl}`;
            modalImage.style.display = "block";
        } else {
            modalImage.style.display = "none";
        }

        modal.style.display = "flex";
    } catch (error) {
        console.error("Error loading blog:", error);
    }
}

// ✅ Close Modal
function closeModal() {
    const modal = document.getElementById("blogModal");
    if (modal) modal.style.display = "none";
}

// ✅ Search Blogs
function searchBlogs() {
    const query = document.getElementById("searchBar").value.toLowerCase();
    document.querySelectorAll(".blog-post").forEach(post => {
        const title = post.querySelector("h3").innerText.toLowerCase();
        post.style.display = title.includes(query) ? "block" : "none";
    });
}

// ✅ Check if user is logged in
async function checkUserProfile() {
    try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json();

        const profileSection = document.getElementById("profileSection");

        if (data.loggedIn) {
            // Logged in
            profileSection.innerHTML = `
                Welcome, ${data.name} |
                <a href="/profile.html">Profile</a> |
                <a href="#" onclick="logoutUser()">Logout</a>
            `;
        } else {
            // Not logged in
            profileSection.innerHTML = `
                <a href="/login.html">Login</a> |
                <a href="/register.html">Register</a>
            `;
        }
    } catch (err) {
        console.error("Profile check failed:", err);
    }
}

// ✅ Logout function
async function logoutUser() {
    try {
        await fetch("/api/logout", { method: "POST", credentials: "include" });
        window.location.reload();
    } catch (err) {
        console.error("Logout failed:", err);
    }
}
