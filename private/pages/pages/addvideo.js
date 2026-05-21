async function video() {
    // Sample video data (in a real app, this would come from your backend API)
    let videoData;

    async function fetchAndDisplayVideos() {
        try {
            const res = await fetch("/api/v1/user/getAllVideos");
            const data = await res.json();

            videoData = data.videos;
        } catch (err) {
            console.error(err);
            alert("Error loading videos.");
        }
    }
    await fetchAndDisplayVideos();

    function openModal(embedUrl) {
        document.getElementById("modalPlayer").src = embedUrl + "?autoplay=1";
        document.getElementById("videoModal").classList.remove("hidden");
    }


    // DOM Elements
    const videosContainer = document.getElementById('videosContainer');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const videoModal = document.getElementById('videoModal');
    const modalVideo = document.getElementById('modalVideo');
    const modalTitle = document.getElementById('modalTitle');
    const closeModal = document.getElementById('closeModal');

    // Function to render videos
    function renderVideos(videos) {
        videosContainer.innerHTML = '';

        videos.forEach(video => {
            const videoElement = document.createElement('div');
            videoElement.className = 'bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition duration-200';
            videoElement.innerHTML = `
                    <div class="video-container relative">
                        <div class="video-placeholder h-48 flex items-center justify-center bg-gray-200">
                            <div class="play-icon absolute opacity-0 transition duration-200">
                                <svg class="w-12 h-12 text-white bg-blue-600 rounded-full p-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                            <img src="${video.thumbnail}" alt="${video.title} thumbnail" class="w-full h-full object-cover">
                        </div>
                        <div class="p-4">
                            <h3 class="text-lg font-semibold text-gray-800 mb-2">${video.title}</h3>
                            <button class="play-btn mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200" data-videourl="${video.youtubeUrl}" data-title="${video.title}">
                                Play Video
                            </button>
                        </div>
                    </div>
                `;
            videosContainer.appendChild(videoElement);
        });

        // Add event listeners to play buttons
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const videoUrl = btn.getAttribute('data-videourl');
                const title = btn.getAttribute('data-title');

                modalVideo.src = videoUrl;
                modalTitle.textContent = title;
                videoModal.classList.remove('hidden');

                // Pause all other videos if any are playing
                document.querySelectorAll('video').forEach(v => {
                    if (v !== modalVideo) v.pause();
                });
            });
        });
    }

    // Initial render
    renderVideos(videoData);

    // Search functionality
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        if (!searchTerm) {
            renderVideos(videoData);
            document.getElementById('noResults').classList.add('hidden');
            return;
        }

        const filteredVideos = videoData.filter(video =>
            video.title.toLowerCase().includes(searchTerm)
        );

        if (filteredVideos.length > 0) {
            renderVideos(filteredVideos);
            document.getElementById('noResults').classList.add('hidden');
        } else {
            videosContainer.innerHTML = '';
            document.getElementById('noResults').classList.remove('hidden');
        }
    }

    document.getElementById('resetSearch').addEventListener('click', () => {
        searchInput.value = '';
        handleSearch();
    });


    closeModal.addEventListener('click', () => {
        modalVideo.src = ''; // stop video by resetting src
        videoModal.classList.add('hidden');
    });

    // Close modal when clicking outside content
    videoModal.addEventListener('click', (e) => {
        if (e.target === videoModal) {
            modalVideo.src = '';
            videoModal.classList.add('hidden');
        }
    });

}
video();