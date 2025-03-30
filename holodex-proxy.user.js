// ==UserScript==
// @name         Custom Holodex Proxy
// @version      0.7.0
// @description  Proxy for Holodex to add user-specified channels from youtube and twitch
// @author       Nep
// @connect      twitch.tv
// @match        https://holodex.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=holodex.net
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Neppu-Nep/HolodexProxy/refs/heads/main/holodex-proxy.user.js
// @downloadURL  https://raw.githubusercontent.com/Neppu-Nep/HolodexProxy/refs/heads/main/holodex-proxy.user.js
// @run-at       document-start
// ==/UserScript==

(async function() {
    'use strict';

    // --- Default Configuration (Used if no settings saved) ---
    const DEFAULT_SETTINGS = {
        youtubeApiKey: "", // User needs to add their key
        updateOneChannelAtATime: true, // Update all channels at once or one at a time
        upcomingUpdateDelayMinutes: 10,
        channelDataUpdateDelayHours: 1,
        channelInfos: { // Original Default Example Channels
            // YouTube Only
            "Tencho": {
                "twitter": "dantencho",
                "thumbnail": "https://yt3.googleusercontent.com/lPDIbTbhdL1N33FVUgLrBfvnaNyFCa7p1Sjuuwyp3Ctli601qCiwJi7OblYbnZu2-jq4m24psQ=s160-c-k-c0x00ffffff-no-rj",
                "youtube": "UCL7NohDGFGRZiTfSDMR7c7A"
            },
            // Twitch Only
            "Mia": {
                "twitter": "matoimiia",
                "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/520504ef-06ba-4bef-a84d-6326b2e330b0-profile_image-70x70.png",
                "twitch": "miia"
            },
            // YouTube and Twitch
            "Nanobites": {
                "twitter": "NANOBITES_",
                "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/491954e0-2aab-40ed-b3d9-f9930609d327-profile_image-70x70.png",
                "twitch": "nanobites",
                "youtube": "UCdqDlrY_4p3z_Ho4hS2-4Zw"
            }
        }
    };

    let settings, DELAY_BETWEEN_UPCOMING_UPDATES, DELAY_BETWEEN_CHANNEL_DATA_UPDATES, YOUTUBE_API_KEY, ChannelInfos, UpdateOneChannelAtATime;

    async function loadSettings() {
        settings = await GM_getValue("holodexProxySettings", DEFAULT_SETTINGS);

        // Ensure settings object has all keys from default
        for (const key in DEFAULT_SETTINGS) {
            if (!(key in settings)) {
                settings[key] = DEFAULT_SETTINGS[key];
            }
        }

        updateRuntimeVariables();
        console.log("[Holodex Proxy] Settings loaded.");
    }

    function updateRuntimeVariables() {
        // Convert delays from saved user-friendly units (minutes/hours) to milliseconds for internal use
        DELAY_BETWEEN_UPCOMING_UPDATES = settings.upcomingUpdateDelayMinutes * 60 * 1000;
        DELAY_BETWEEN_CHANNEL_DATA_UPDATES = settings.channelDataUpdateDelayHours * 60 * 60 * 1000;
        YOUTUBE_API_KEY = settings.youtubeApiKey;
        ChannelInfos = settings.channelInfos;
        UpdateOneChannelAtATime = settings.updateOneChannelAtATime;
        console.log("[Holodex Proxy] Runtime variables updated.");
    }

    await loadSettings(); // Load settings initially

    // --- Settings UI ---
    function createSettingsModal() {
        const existingModal = document.getElementById('holodex-proxy-settings-modal');
        if (existingModal) existingModal.remove();

        // Create a deep copy of the current ChannelInfos for editing in the modal
        // without affecting the runtime variable until "Save" is clicked.
        let modalChannelInfos = JSON.parse(JSON.stringify(ChannelInfos));

        const modal = document.createElement('div');
        modal.id = 'holodex-proxy-settings-modal';
        modal.innerHTML = `
            <div class="hp-modal-content">
                <span class="hp-close-btn">×</span>
                <h2>Holodex Proxy Settings</h2>

                <div class="hp-form-group">
                    <label for="hp-api-key">YouTube Data API v3 Key:</label>
                    <input type="password" id="hp-api-key" value="${settings.youtubeApiKey}">
                     <button type="button" id="hp-toggle-api-key" style="margin-left: 5px; font-size: 0.8em;">Show</button>
                </div>

                <div class="hp-form-group">
                    <label for="hp-upcoming-delay">Update Upcoming Streams Every (Minutes):</label>
                    <input type="number" id="hp-upcoming-delay" min="1" value="${settings.upcomingUpdateDelayMinutes}">
                </div>

                <div class="hp-form-group">
                    <label for="hp-channel-delay">Update Channel/Video Archives Every (Hours):</label>
                    <input type="number" id="hp-channel-delay" min="1" value="${settings.channelDataUpdateDelayHours}">
                </div>

                <div class="hp-form-group">
                    <label for="hp-update-one-channel">Update One Channel at a Time:</label>
                    <input type="checkbox" id="hp-update-one-channel" ${settings.updateOneChannelAtATime ? 'checked' : ''}>
                </div>
                <small style="display: block; margin-top: 5px;">When enabled, only one channel will be updated at a time. This is useful for large channel lists.</small>

                <hr>
                <h3>Managed Channels</h3>
                <div id="hp-channel-list">
                    </div>
                <button type="button" id="hp-add-channel-btn">Add New Channel</button>
                <div id="hp-add-edit-form" style="display: none; border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
                    <h4 id="hp-form-title">Add New Channel</h4>
                    <input type="hidden" id="hp-edit-key" value="">
                     <div class="hp-form-group">
                        <label for="hp-channel-name">Display Name*:</label>
                        <input type="text" id="hp-channel-name">
                    </div>
                     <div class="hp-form-group">
                        <label for="hp-channel-twitter">Twitter Handle (no @):</label>
                        <input type="text" id="hp-channel-twitter">
                    </div>
                    <div class="hp-form-group">
                        <label for="hp-channel-thumb">Thumbnail URL:</label>
                        <input type="url" id="hp-channel-thumb">
                    </div>
                     <div class="hp-form-group">
                        <label for="hp-channel-yt">YouTube Channel ID:</label>
                        <input type="text" id="hp-channel-yt">
                    </div>
                    <div class="hp-form-group">
                        <label for="hp-channel-twitch">Twitch Username:</label>
                        <input type="text" id="hp-channel-twitch">
                    </div>
                    <button type="button" id="hp-save-channel-btn">Save Channel Change</button>
                    <button type="button" id="hp-cancel-channel-btn">Cancel Edit</button>
                    <small style="display: block; margin-top: 5px;">* Display Name is required. Provide at least a YouTube ID or Twitch Username.</small>
                </div>

                <hr>
                <div class="hp-modal-buttons">
                    <button type="button" id="hp-save-settings-btn">Save & Apply Settings</button>
                    <button type="button" id="hp-cancel-settings-btn">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        addModalStyles();

        // --- Event Listeners specific to this modal instance ---
        const listDiv = modal.querySelector('#hp-channel-list');
        const addEditForm = modal.querySelector('#hp-add-edit-form');
        const addChannelBtn = modal.querySelector('#hp-add-channel-btn');
        const nameInput = modal.querySelector('#hp-channel-name');
        const twitterInput = modal.querySelector('#hp-channel-twitter');
        const thumbInput = modal.querySelector('#hp-channel-thumb');
        const ytInput = modal.querySelector('#hp-channel-yt');
        const twitchInput = modal.querySelector('#hp-channel-twitch');
        const formTitle = modal.querySelector('#hp-form-title');
        const editKeyInput = modal.querySelector('#hp-edit-key');
        const saveChannelBtn = modal.querySelector('#hp-save-channel-btn');
        const cancelChannelBtn = modal.querySelector('#hp-cancel-channel-btn');
        const saveSettingsBtn = modal.querySelector('#hp-save-settings-btn');
        const cancelSettingsBtn = modal.querySelector('#hp-cancel-settings-btn');
        const closeBtn = modal.querySelector('.hp-close-btn');
        const apiKeyInput = modal.querySelector('#hp-api-key');
        const toggleApiKeyBtn = modal.querySelector('#hp-toggle-api-key');


        function renderModalChannelList() {
            if (!listDiv) return;
            listDiv.innerHTML = ''; // Clear previous list

            if (Object.keys(modalChannelInfos).length === 0) {
                listDiv.innerHTML = '<p>No channels configured.</p>';
                return;
            }

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Twitter</th>
                        <th>YouTube</th>
                        <th>Twitch</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>`;

            const tbody = table.querySelector('tbody');
            for (const name in modalChannelInfos) {
                const info = modalChannelInfos[name];
                const tr = document.createElement('tr');
                // Use optional chaining for safety, provide 'N/A' fallback
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${info?.twitter || 'N/A'}</td>
                    <td>${info?.youtube || 'N/A'}</td>
                    <td>${info?.twitch || 'N/A'}</td>
                    <td>
                        <button class="hp-edit-channel-btn" data-key="${name}">Edit</button>
                        <button class="hp-delete-channel-btn" data-key="${name}">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
            listDiv.appendChild(table);

            // Add event listeners for edit/delete buttons within this modal's scope
            listDiv.querySelectorAll('.hp-edit-channel-btn').forEach(btn => {
                btn.addEventListener('click', () => showModalAddEditForm(btn.dataset.key));
            });
            listDiv.querySelectorAll('.hp-delete-channel-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteModalChannel(btn.dataset.key));
            });
        }

        function showModalAddEditForm(key = null) {
            if (key && modalChannelInfos[key]) { // Editing
                const data = modalChannelInfos[key];
                formTitle.textContent = `Edit Channel: ${key}`;
                editKeyInput.value = key;
                nameInput.value = key;
                twitterInput.value = data.twitter || '';
                thumbInput.value = data.thumbnail || '';
                ytInput.value = data.youtube || '';
                twitchInput.value = data.twitch || '';
                nameInput.disabled = true; // Prevent changing the key/display name when editing

            } else { // Adding new
                formTitle.textContent = 'Add New Channel';
                editKeyInput.value = '';
                nameInput.value = '';
                twitterInput.value = '';
                thumbInput.value = '';
                ytInput.value = '';
                twitchInput.value = '';
                nameInput.disabled = false;
            }
            addEditForm.style.display = 'block';
            addChannelBtn.style.display = 'none'; // Hide Add button
        }

        function hideModalAddEditForm() {
            addEditForm.style.display = 'none';
            addChannelBtn.style.display = 'inline-block'; // Show Add button
        }

        function saveModalChannelChange() {
            const originalKey = editKeyInput.value;
            const name = nameInput.value.trim();
            const twitter = twitterInput.value.trim();
            const thumbnail = thumbInput.value.trim();
            const youtube = ytInput.value.trim();
            const twitch = twitchInput.value.trim();

            if (!name) {
                alert('Display Name is required.');
                return; 
            }

            if (!youtube && !twitch) {
                alert('Provide either a YouTube Channel ID or a Twitch Username to track.');
                return;
            }

            // If adding new, check if name already exists in the temporary modal list
            if (!originalKey && modalChannelInfos[name]) {
                alert(`A channel with the name "${name}" already exists. Please use a unique name.`);
                return;
            }

            const channelData = {
                twitter: twitter || undefined,
                thumbnail: thumbnail || undefined,
                youtube: youtube || undefined,
                twitch: twitch || undefined
            };

            // We are modifying the modal's temporary copy (modalChannelInfos)
            // Since name editing is disabled, no need to delete old key
            modalChannelInfos[name] = channelData; // Add or update in the temporary copy

            renderModalChannelList(); // Re-render list in modal
            hideModalAddEditForm();
            console.log(`[Holodex Proxy] Channel "${name}" added or changed.`);
        }

        function deleteModalChannel(key) {
            if (confirm(`Are you sure you want to delete the channel "${key}" from the configuration?`)) {
                delete modalChannelInfos[key]; // Delete from the temporary copy
                renderModalChannelList(); // Re-render list in modal
                console.log(`[Holodex Proxy] Channel "${key}" deleted.`);
            }
        }

        // --- Main Modal Button Listeners ---
        closeBtn.addEventListener('click', () => modal.remove());
        cancelSettingsBtn.addEventListener('click', () => modal.remove());
        addChannelBtn.addEventListener('click', () => showModalAddEditForm());
        cancelChannelBtn.addEventListener('click', hideModalAddEditForm);
        saveChannelBtn.addEventListener('click', saveModalChannelChange);

        toggleApiKeyBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleApiKeyBtn.textContent = 'Hide';
            } else {
                apiKeyInput.type = 'password';
                toggleApiKeyBtn.textContent = 'Show';
            }
        });

        saveSettingsBtn.addEventListener('click', async () => {
            const newApiKey = apiKeyInput.value.trim();
            const updateOneChannelAtATime = modal.querySelector('#hp-update-one-channel').checked;
            const newUpcomingDelay = parseInt(modal.querySelector('#hp-upcoming-delay').value, 10);
            const newChannelDelay = parseInt(modal.querySelector('#hp-channel-delay').value, 10);

            if (isNaN(newUpcomingDelay) || newUpcomingDelay < 1) {
                alert("Please enter a valid number (>= 1) for the upcoming streams delay.");
                return;
            }

            if (isNaN(newChannelDelay) || newChannelDelay < 1) {
                alert("Please enter a valid number (>= 1) for the channel data delay.");
                return;
            }

            // Prepare the complete settings object to save
            const newSettings = {
                youtubeApiKey: newApiKey,
                updateOneChannelAtATime: updateOneChannelAtATime,
                upcomingUpdateDelayMinutes: newUpcomingDelay,
                channelDataUpdateDelayHours: newChannelDelay,
                channelInfos: modalChannelInfos // Save the modified channel list from the modal
            };

            try {
                await GM_setValue("holodexProxySettings", newSettings);
                settings = newSettings;
                updateRuntimeVariables();
                console.log("[Holodex Proxy] Settings saved and applied to runtime.");
                alert("Settings saved and applied.");
                modal.remove();
                updateData(true); // Trigger an update check immediately after saving
            } catch (e) {
                console.error("[Holodex Proxy] Error saving settings:", e);
                alert("Error saving settings. See console for details.");
            }
        });

        // Initial population of the channel list in the modal
        renderModalChannelList();
    }

    function addModalStyles() {
        GM_addStyle(`
            #holodex-proxy-settings-modal {
                position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%;
                overflow: auto; background-color: rgba(0,0,0,0.5); display: flex;
                align-items: center; justify-content: center;
            }
            .hp-modal-content {
                background-color: #2d3748; color: #e2e8f0; margin: auto; padding: 20px;
                border: 1px solid #4a5568; border-radius: 8px; width: 80%; max-width: 700px;
                max-height: 90vh; overflow-y: auto; position: relative;
            }
            .hp-close-btn {
                color: #aaa; position: absolute; top: 10px; right: 15px;
                font-size: 28px; font-weight: bold; cursor: pointer;
            }
            .hp-close-btn:hover, .hp-close-btn:focus { color: #fff; text-decoration: none; }
            .hp-form-group { margin-bottom: 15px; }
            .hp-form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
            .hp-form-group input[type="text"], .hp-form-group input[type="password"],
            .hp-form-group input[type="number"], .hp-form-group input[type="url"] {
                width: calc(100% - 22px); padding: 10px; background-color: #4a5568;
                border: 1px solid #718096; color: #e2e8f0; border-radius: 4px;
            }
            .hp-form-group input[type="number"] { width: 100px; }
            #holodex-proxy-settings-modal button {
                background-color: #4a5568; color: #e2e8f0; padding: 8px 15px;
                border: 1px solid #718096; border-radius: 4px; cursor: pointer;
                margin-right: 5px; transition: background-color 0.2s;
            }
            #holodex-proxy-settings-modal button:hover { background-color: #718096; }
            #hp-save-settings-btn, #hp-save-channel-btn { background-color: #38a169; }
            #hp-save-settings-btn:hover, #hp-save-channel-btn:hover { background-color: #48bb78; }
            #hp-delete-channel-btn { background-color: #c53030; font-size: 0.8em; padding: 4px 8px; }
            #hp-delete-channel-btn:hover { background-color: #e53e3e; }
            .hp-modal-buttons { margin-top: 20px; text-align: right; }
            #hp-channel-list table { border: 1px solid #4a5568; margin-top: 10px; }
            #hp-channel-list th, #hp-channel-list td { padding: 8px; border: 1px solid #4a5568; text-align: left; }
            #hp-channel-list th { background-color: #4a5568; }
            #hp-channel-list button { font-size: 0.9em; padding: 4px 8px;}
            #hp-add-edit-form { background-color: #4a5568; border-radius: 5px; }
            hr { border: 0; border-top: 1px solid #4a5568; margin: 20px 0; }
        `);
    }

    // Register the menu command
    GM_registerMenuCommand("Holodex Proxy Settings", createSettingsModal);


    // --- Details Initialization ---
    async function initDetails() {
        let config = null;
        
        if (localStorage.getItem("HolodexProxyDetails")) {
            config = JSON.parse(localStorage.getItem("HolodexProxyDetails"));
        }

        if (!config) {
            config = {streamsData: [], channelsData: {}, lastStreamDataUpdate: 0, lastChannelDataUpdate: 0};
            console.log("[Holodex Proxy] No cache found. Creating new cache.");
        }

        localStorage.setItem("HolodexProxyDetails", JSON.stringify(config));
        unsafeWindow.HolodexProxyVideoTemp = [];
        unsafeWindow.HolodexProxyDetails = config;
    }

    await initDetails();
    let oldXHROpen = window.XMLHttpRequest.prototype.open;

    window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {

        // Only intercept requests to Holodex
        if (!url.includes('holodex.net')) {
            return oldXHROpen.apply(this, arguments);
        }

        let customRequestToChannelId = null;
        let customRequestToVideoId = null;
        let parsedUrl = new URL(url);

        if (parsedUrl.pathname.includes("/api/v2/channels")) {
            let channelId = parsedUrl.pathname.split("/").pop();
            if (["videos", "clips", "collabs"].includes(channelId)) channelId = parsedUrl.pathname.split("/")[(parsedUrl.pathname.split("/").length - 2)];

            if (channelId in unsafeWindow.HolodexProxyDetails.channelsData) {
                // Ensure this channel is actually in the *current settings*
                const isConfiguredChannel = Object.values(ChannelInfos).some(info => info && info.youtube === channelId);
                if (isConfiguredChannel) {
                    console.log(`[Holodex Proxy] Intercepted request to Custom Channel ID: ${channelId}`);
                    url = url.toString().replace(channelId, "UCp6993wxpyDPHUpavwDFqgg"); // Tokino Sora Channel ID
                    customRequestToChannelId = channelId;
                } else {
                    console.log(`[Holodex Proxy] Channel ${channelId} found in cache but not in current config. Ignoring.`);
                }
            }
        }
        else if (parsedUrl.pathname.includes("/api/v2/videos")) {
            let videoId = parsedUrl.pathname.split("/").pop();
            if (["mentions", "topic"].includes(videoId)) videoId = parsedUrl.pathname.split("/")[(parsedUrl.pathname.split("/").length - 2)];

            // Check against the *runtime* temp video cache
            let videoData = unsafeWindow.HolodexProxyVideoTemp.find(video => video && video.id === videoId);
            if (videoData) {
                console.log(`[Holodex Proxy] Intercepted request to Custom Video ID: ${videoId}`);
                url = url.toString().replace(videoId, "ZXF1SzAtFj8"); // Tokino Sora First Video ID
                customRequestToVideoId = videoId;
            }
        }

        parsedUrl = new URL(url); // Re-parse the url after changing it

        this.addEventListener("readystatechange", function() {

            if (this.readyState === 4 && this.status !== 0) {
                let oldResponse;
                try {
                    oldResponse = JSON.parse(this.responseText);
                } catch (e) {
                    console.error(`[Holodex Proxy] Failed to parse original JSON response for ${parsedUrl.href}. Status: ${this.status}. Error: ${e}`);
                    return;
                }

                let newResponse = undefined;
                Object.defineProperty(this, 'response', { writable: true });
                Object.defineProperty(this, 'responseText', { writable: true });

                const proxyDetails = unsafeWindow.HolodexProxyDetails;

                if (parsedUrl.pathname.includes("/api/v2/users/live")) {
                    if (Array.isArray(oldResponse) && Array.isArray(proxyDetails.streamsData)) {
                        newResponse = oldResponse.concat(proxyDetails.streamsData);
                    } else {
                        console.warn("[Holodex Proxy] Invalid data for /live merge.", oldResponse, proxyDetails.streamsData);
                        newResponse = oldResponse;
                    }
                }
                else if (parsedUrl.pathname.includes("/api/v2/users/favorites")) {
                    let favData = [];
                    for (let key in ChannelInfos) {
                        const ytId = ChannelInfos[key]?.youtube;
                        // Check if data exists in the *runtime cache*
                        if (ytId && proxyDetails.channelsData && proxyDetails.channelsData[ytId]?.channelData) {
                            const channelData = proxyDetails.channelsData[ytId].channelData;
                            favData.push({
                                id: channelData.id,
                                name: channelData.name,
                                english_name: channelData.english_name,
                                photo: channelData.photo,
                                type: channelData.type,
                                subscriber_count: channelData.subscriber_count,
                                video_count: channelData.video_count,
                                clip_count: channelData.clip_count,
                                twitter: channelData.twitter,
                                org: channelData.org,
                                inactive: channelData.inactive,
                                group: channelData.group
                            });
                        }
                    }

                    newResponse = oldResponse.concat(favData);
                }
                else if (parsedUrl.pathname.includes("/api/v2/users/videos")) {

                    let earliestDate = new Date();
                    let latestDate = new Date(0);
    
                    for (let video of oldResponse.items) {
                        let videoDate = new Date(video.available_at);
                        earliestDate = new Date(Math.min(earliestDate, videoDate));
                        latestDate = new Date(Math.max(latestDate, videoDate));
                    }

                    // Use the *runtime* temp video cache
                    let newVideos = unsafeWindow.HolodexProxyVideoTemp.filter(video => {
                        // Added check for video validity and status
                        if (!video || !video.available_at || video.status !== "past") {
                            return false;
                        }
                        const videoDate = new Date(video.available_at);
                        return videoDate < latestDate && videoDate >= earliestDate;
                    });

                    let allVideos = oldResponse.items.concat(newVideos);
                    // Added deduplication before sorting
                    const seenIds = new Set();
                    allVideos = allVideos.filter(video => {
                        if (!video || !video.id || seenIds.has(video.id)) return false;
                        seenIds.add(video.id);
                        return true;
                    });
                    let sortedVideos = allVideos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));

                    newResponse = {
                        "items": sortedVideos,
                        "total": sortedVideos.length
                    };
                }
                else if (customRequestToChannelId !== null || customRequestToVideoId !== null) {
                    Object.defineProperty(this, 'status', {get: () => 200, configurable: true});

                    if (parsedUrl.pathname.includes("/api/v2/channels")) {
                        if (parsedUrl.search == "") {
                            newResponse = unsafeWindow.HolodexProxyDetails.channelsData[customRequestToChannelId]?.channelData || null;
                        }
                        else if (parsedUrl.pathname.endsWith("/videos")) {
                            const offset = parseInt(parsedUrl.searchParams.get("offset"));
                            const limit = parseInt(parsedUrl.searchParams.get("limit"));
                            const allChannelVideos = proxyDetails.channelsData[customRequestToChannelId]?.videos || [];
                            // Added filtering and sorting based on available_at before slicing
                            const sortedVideos = allChannelVideos
                                .filter(v => v && v.available_at) // Ensure video and date exist
                                .sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                            const videos = sortedVideos.slice(offset, offset + limit);
                            newResponse = {
                                "items": videos,
                                "total": sortedVideos.length
                            };
                        }
                        else {
                            newResponse = { "items": [], "total": 0 };
                        }
                    }
                    else if (parsedUrl.pathname.includes("/api/v2/videos")) {
                        if (parsedUrl.pathname.endsWith("/mentions")) {
                            newResponse = [];
                        }
                        else if (parsedUrl.pathname.endsWith("/topic")) {
                            newResponse = { "topic_id": null, "topic_approver_id":null };
                        }
                        else {
                            const videoData = unsafeWindow.HolodexProxyVideoTemp.find(video => video && video.id === customRequestToVideoId);
                            if (!videoData) {
                                console.error(`[Holodex Proxy] Video ${customRequestToVideoId} data missing in temp cache! Returning default video data.`);
                                Object.defineProperty(this, 'status', {get: () => 404, configurable: true});
                            }
                            else {
                                newResponse = videoData;
                            }
                        }
                    }
                }

                this.response = this.responseText = JSON.stringify(newResponse || oldResponse); // Set response to newResponse or oldResponse if no modification
            }
        });

        return oldXHROpen.apply(this, arguments);
    };

    // --- Data Fetching Functions ---
    async function fetchYtVideosData(videoIds, api_key, mode = "stream") {

        if (api_key === "") {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube data fetch.");
            return [];
        }
        if (!videoIds || videoIds.length === 0) return []; // Added check for empty array

        let finalResponse = [];
        for (let i = 0; i < videoIds.length; i += 50) {
            const chunk = videoIds.slice(i, i + 50);
            const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,contentDetails&id=${chunk.join(",")}&key=${api_key}`;

            try {
                const videoResponse = await fetch(videoUrl);
                if (!videoResponse.ok) {
                    console.error(`[Holodex Proxy] YouTube API error (${videoResponse.status}) fetching video data:`, await videoResponse.text());
                    continue; // Skip this chunk
                }
                const videoData = await videoResponse.json();

                for (const item of videoData.items || []) {
                    const isLive = item.snippet.liveBroadcastContent;

                    if (mode === "stream" && !item.liveStreamingDetails.scheduledStartTime) {
                        continue;
                    }

                    // Original result structure
                    let result = {
                        id: item.id,
                        title: item.snippet.title,
                        type: "stream",
                        published_at: item.snippet.publishedAt,
                        available_at: mode === "stream" ? item.liveStreamingDetails.scheduledStartTime : item.snippet.publishedAt,
                        duration: 0,
                        status: isLive === "none" ? "past" : isLive,
                        start_scheduled: mode === "stream" ? item.liveStreamingDetails.scheduledStartTime : item.snippet.publishedAt,
                        live_viewers: isLive === "live" ? item.liveStreamingDetails.concurrentViewers : 0,
                        channel: {
                            id: item.snippet.channelId,
                            name: item.snippet.channelTitle,
                            org: "Independents",
                            suborg: "",
                            type: "vtuber",
                            photo: "",
                            english_name: item.snippet.channelTitle
                        }
                    };

                    if (isLive === "live" && item.liveStreamingDetails.actualStartTime) {
                        result.start_actual = item.liveStreamingDetails.actualStartTime;
                    }
                    else if (isLive === "none" && mode === "stream") {
                        result.start_actual = item.liveStreamingDetails ? item.liveStreamingDetails.actualStartTime : item.snippet.publishedAt;
                        result.end_actual = item.liveStreamingDetails.actualEndTime;
                        result.duration = (new Date(item.liveStreamingDetails.actualEndTime) - new Date(item.liveStreamingDetails.actualStartTime)) / 1000;
                        result.clips = [];
                    }
                    else if (isLive === "none") {
                        try {
                            const durationString = item.contentDetails.duration.substring(2);
                            const duration = durationString.match(/(\d+H)?(\d+M)?(\d+S)?/);
                            const hours = (parseInt(duration[1]) || 0);
                            const minutes = (parseInt(duration[2]) || 0);
                            const seconds = (parseInt(duration[3]) || 0);
                            result.duration = hours * 3600 + minutes * 60 + seconds;
                        }
                        catch (e) {
                            console.warn(`[Holodex Proxy] Could not parse duration string: ${item.contentDetails.duration}`);
                        }
                        result.clips = [];
                    }

                    finalResponse.push(result);
                }
            } catch (error) {
                console.error(`[Holodex Proxy] Error fetching or processing video chunk ${i/50}:`, error);
            }
        }
        return finalResponse;
    }

    async function checkYt(channelIds, api_key, limit = true, count = 7, mode = "stream") {

        if (api_key === "") {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube data fetch.");
            return [];
        }
        if (!channelIds || channelIds.length === 0) return [];

        let videoIds = [];
        const modes = {
            "videos": "UULF",
            "stream": "UULV",
            "membersonly": "UUMO",
            "membersonlylive": "UUMV",
            "shorts": "UUSH",
        };

        await Promise.all(channelIds.map(async (channelId) => {
            console.log(`[Holodex Proxy] Fetching youtube data for ${channelId} (${mode}) with count ${count}`);
            const playlistId = `${modes[mode]}${channelId.substring(2)}`;
            let nextPageToken = null;
            let fetchedCount = 0;

            try {
                while (true) {
                    const maxResults = limit ? Math.min(50, count - fetchedCount) : 50;
                    if (limit && maxResults <= 0) break;

                    const playlistUrl = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${maxResults}&playlistId=${playlistId}&key=${api_key}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
                    const response = await fetch(playlistUrl);
                    const data = await response.json();

                    for (const item of data.items) {
                        videoIds.push(item.snippet.resourceId.videoId);
                        fetchedCount++;
                        if (limit && fetchedCount >= count) break;
                    }

                    if ((limit && fetchedCount >= count) || !data.nextPageToken) {
                        break;
                    }
                    nextPageToken = data.nextPageToken;
                    await new Promise(r => setTimeout(r, 50));
                }
            } catch (err) {
                if (playlistId.includes("UUMO") || playlistId.includes("UUMV")) {
                    console.warn(`[Holodex Proxy] Members-only playlist ${playlistId} not found. This is expected if the channel has no members-only content.`);
                }
                else if (playlistId.includes("UULS")) {
                    console.warn(`[Holodex Proxy] Shorts playlist ${playlistId} not found. This is expected if the channel has no shorts content.`);
                }
                else {
                    console.error(`[Holodex Proxy] Error fetching playlist ${playlistId}:`, err);
                }
            }
        }));

        // Deduplicate IDs before fetching details
        const uniqueVideoIds = [...new Set(videoIds)];
        if (uniqueVideoIds.length === 0) {
            return [];
        }

        const finalResponse = await fetchYtVideosData(uniqueVideoIds, api_key, mode);
        return finalResponse;
    }

    async function GM_fetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: (response) => {
                    resolve(response.responseText);
                },
                onerror: (error) => {
                    console.error("[Holodex Proxy] GM_fetch error:", error);
                    reject(error);
                }
            });
        });
    }

    function generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    async function checkTwitch(channelIds) {
         if (!channelIds || channelIds.length === 0) return [];

        let finalResponse = [];
        await Promise.all(channelIds.map(async ([channelId, channelName]) => {
            console.log(`[Holodex Proxy] Fetching twitch data for ${channelId}`);
            try {
                const data = await GM_fetch(`https://twitch.tv/${channelId}`);
                if (!data) {
                    console.warn(`[Holodex Proxy] No data received from Twitch scrape for ${channelId}`);
                    return;
                 }

                if (data.includes("isLiveBroadcast")) {

                    const thumb_url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelId}-1920x1080.jpg`;
                    const thumb_data = await fetch(thumb_url);
                    if (thumb_data.redirected) {
                        return;
                    }

                    let parsedData;
                    try {
                        let firstPart = data.substring(data.indexOf('<script type="application/ld+json">') + 35);
                        parsedData = JSON.parse(firstPart.substring(0, firstPart.indexOf("</script>")))["@graph"][0];

                    } catch (parseError) {
                        console.error(`[Holodex Proxy] Error parsing Twitch JSON-LD for ${channelId}:`, parseError);
                        return;
                    }

                    finalResponse.push({
                        id: `hpproxy${generateRandomString(6)}`,
                        title: parsedData.description,
                        type: "placeholder",
                        available_at: parsedData.publication.startDate,
                        duration: 0,
                        status: "live",
                        start_scheduled: parsedData.publication.startDate,
                        start_actual: parsedData.publication.startDate,
                        channel: {
                            id: channelId,
                            name: channelName,
                            org: "Independents",
                            suborg: "",
                            type: "vtuber",
                            photo: "",
                            english_name: channelName,
                        },
                        link: `https://twitch.tv/${channelId}`,
                        certainty: "certain",
                        thumbnail: thumb_url,
                        placeholderType: "external-stream",
                    });
                }
            } catch (err) {
                console.error(`[Holodex Proxy] Error fetching or processing Twitch data for ${channelId}:`, err);
            }
        }));
        return finalResponse;
    }

    let updateTimeout = null;
    async function updateData(force = false) {

        if (updateTimeout) {
            clearTimeout(updateTimeout);
            updateTimeout = null;
        }

        const currentTimestamp = Date.now();
        const proxyDetails = unsafeWindow.HolodexProxyDetails;

        // Check if cache exists, initialize if not (should be handled by initDetails already)
        if (!proxyDetails) {
            console.error("[Holodex Proxy] Cache object not found during updateData!");
            await initDetails(); // Re-initialize as a fallback
            if (!unsafeWindow.HolodexProxyDetails) return; // Stop if still fails
        }

        // --- Upcoming/Live Update ---
        if (force || !proxyDetails.lastStreamDataUpdate || currentTimestamp - proxyDetails.lastStreamDataUpdate > DELAY_BETWEEN_UPCOMING_UPDATES) {
            console.log("[Holodex Proxy] Updating upcoming livestream data");

            // Get channels from the *runtime* ChannelInfos variable
            const ytChannels = Object.values(ChannelInfos).map(info => info?.youtube).filter(Boolean);
            const twitchChannels = Object.entries(ChannelInfos)
                .filter(([_, info]) => info?.twitch)
                .map(([name, info]) => [info.twitch, name]);

            try {
                let ytData = await checkYt(ytChannels, YOUTUBE_API_KEY); // Default mode is 'stream'
                let ytMembersData = await checkYt(ytChannels, YOUTUBE_API_KEY, false, 7, "membersonlylive");
                let twitchData = await checkTwitch(twitchChannels);

                let combinedData = ytData.concat(twitchData).concat(ytMembersData);
                let finalData = combinedData.filter(video => video && video.duration === 0);

                unsafeWindow.HolodexProxyDetails.streamsData = finalData;
                console.log(`[Holodex Proxy] Live/Upcoming update complete. Found ${finalData.length} items.`);
            } catch (e) {
                console.error("[Holodex Proxy] Error during live/upcoming fetch:", e);
            }

            unsafeWindow.HolodexProxyDetails.lastStreamDataUpdate = currentTimestamp;
        } else {
            const nextUpdateSec = Math.round((DELAY_BETWEEN_UPCOMING_UPDATES - (currentTimestamp - proxyDetails.lastStreamDataUpdate)) / 1000);
            console.log(`[Holodex Proxy] Upcoming livestream data is up to date. Next check in ${nextUpdateSec} seconds`);
        }

        // --- Channel & Archive Update ---

        // Remove inactive channels from cache (based on current ChannelInfos)
        const activeYoutubeIds = new Set(Object.values(ChannelInfos).map(info => info?.youtube).filter(Boolean));
        for (let key in proxyDetails.channelsData) {
            if (!activeYoutubeIds.has(key)) {
                 console.log(`[Holodex Proxy] Removing inactive channel ${key} from cache.`);
                delete proxyDetails.channelsData[key];
            }
        }

        if (force || !proxyDetails.lastChannelDataUpdate || currentTimestamp - proxyDetails.lastChannelDataUpdate > DELAY_BETWEEN_CHANNEL_DATA_UPDATES) {
            console.log("[Holodex Proxy] Refreshing Extra details data (Channel/Archive Update Cycle)");

            let channelUpdatedThisCycle = false; // Track if any channel was updated this cycle

            // Iterate through the *runtime* ChannelInfos
            for (let key in ChannelInfos) {
                if (UpdateOneChannelAtATime && channelUpdatedThisCycle) {
                    break; // Only update one channel per cycle if set
                }

                let youtubeKey = ChannelInfos[key]?.youtube;
                if (!youtubeKey) {
                    continue;
                }

                console.log(`[Holodex Proxy] Checking channel data for ${key} (${youtubeKey})`);

                // Initialize cache entry if needed
                if (!(youtubeKey in proxyDetails.channelsData)) {
                    proxyDetails.channelsData[youtubeKey] = { channelData: {}, videos: [] };
                }
                let currentChannel = proxyDetails.channelsData[youtubeKey];

                // Only update a channel every 24 hours
                if (currentChannel.channelData?.updated_at && currentTimestamp - new Date(currentChannel.channelData.updated_at).getTime() < 1000 * 60 * 60 * 24) {
                    console.log(`[Holodex Proxy] Channel ${key} (${youtubeKey}) is up to date. Skipping.`);
                    continue;
                }
                currentChannel.channelData.updated_at = new Date().toISOString(); // Update timestamp

                // Update existing live/upcoming videos in cache
                const liveOrUpcomingVids = currentChannel.videos.filter(video => video && (video.status === "live" || video.status === "upcoming"));
                if (liveOrUpcomingVids.length > 0) {
                    console.log(`[Holodex Proxy] Updating status for ${liveOrUpcomingVids.length} cached live/upcoming videos for ${key}`);
                    try {
                        let liveOrUpcomingVidsIds = liveOrUpcomingVids.map(video => video.id);
                        const liveOrUpcomingVidsData = await fetchYtVideosData(liveOrUpcomingVidsIds, YOUTUBE_API_KEY, "stream");

                        liveOrUpcomingVidsData.forEach(video => {
                            console.log(`[Holodex Proxy] Updating video ${video.id} from ${video.channel.id} (${video.channel.name})`);
                            const index = currentChannel.videos.findIndex(v => v && v.id === video.id);
                            if (index !== -1) {
                                currentChannel.videos[index] = video;
                            }
                            else {
                                currentChannel.videos.push(video);
                            }
                            liveOrUpcomingVidsIds = liveOrUpcomingVidsIds.filter(id => id !== video.id);
                        });

                        // Remove any videos that are no longer live/upcoming
                        currentChannel.videos = currentChannel.videos.filter(v => v && !liveOrUpcomingVidsIds.includes(v.id));
                        currentChannel.videos = currentChannel.videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                        channelUpdatedThisCycle = true;
                    }
                    catch (e) {
                        console.error(`[Holodex Proxy] Error updating live/upcoming video status for ${key}:`, e);
                    }
                }

                unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey] = currentChannel;

                // Only recrawl everything every 7 days
                if (currentChannel.channelData?.recrawled_at && currentTimestamp - new Date(currentChannel.channelData.recrawled_at).getTime() < 1000 * 60 * 60 * 24 * 7) {
                    console.log(`[Holodex Proxy] Channel ${key} (${youtubeKey}) is up to date. Skipping.`);
                    continue;
                }

                console.log(`[Holodex Proxy] Channel ${key} (${youtubeKey}) probably needs full recrawl.`);

                try {
                    let response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,id,snippet,statistics,brandingSettings&id=${youtubeKey}&key=${YOUTUBE_API_KEY}`);
                    let data = await response.json();
                    if (data.items && data.items.length > 0) {
                        currentChannel.channelData = {
                            id: youtubeKey,
                            name: data.items[0].snippet.title,
                            english_name: data.items[0].snippet.title,
                            description: data.items[0].snippet.description,
                            photo: data.items[0].snippet.thumbnails.default.url,
                            thumbnail: null,
                            banner: data.items[0].brandingSettings.image ? data.items[0].brandingSettings.image.bannerExternalUrl : "",
                            org: "Independents",
                            suborg: "",
                            lang: null,
                            published_at: data.items[0].snippet.publishedAt,
                            view_count: data.items[0].statistics.viewCount,
                            video_count: data.items[0].statistics.videoCount,
                            subscriber_count: data.items[0].statistics.subscriberCount,
                            comments_crawled_at: "",
                            updated_at: new Date().toISOString(),
                            recrawled_at: new Date().toISOString(),
                            yt_uploads_id: data.items[0].contentDetails.relatedPlaylists.uploads,
                            crawled_at: "",
                            type: "vtuber",
                            clip_count: 0,
                            twitter: ChannelInfos[key].twitter || "",
                            inactive: false,
                            created_at: "",
                            top_topics: [],
                            yt_handle: [data.items[0].snippet.customUrl],
                            twitch: ChannelInfos[key].twitch || null,
                            yt_name_history: [],
                            groups: ""
                        };
                        console.log(`[Holodex Proxy] Channel details updated for ${key}.`);
                    }
                    else {
                        console.warn(`[Holodex Proxy] No channel data returned for ${youtubeKey}`);
                    }
                }
                catch (e) {
                    console.error(`[Holodex Proxy] Error fetching channel details for ${key}:`, e);
                }

                try {
                    const modes = ["videos", "stream", "membersonly", "shorts"];
                    let currentCount = 0;
                    for (const mode of modes) {
                        const videoData = await checkYt([youtubeKey], YOUTUBE_API_KEY, false, currentChannel.channelData.video_count - currentCount, mode);
                        currentCount += videoData.length;
                        currentChannel.videos = videoData.concat(currentChannel.videos);
                        currentChannel.videos = currentChannel.videos.filter((video, index, self) => self.findIndex(v => v.id === video.id) === index);
                        await new Promise(r => setTimeout(r, 5000));
                    }
                    console.log(`[Holodex Proxy] Full video recrawl complete for ${key}. Total videos: ${currentChannel.videos.length}`);
                } 
                catch (e) {
                    console.error(`[Holodex Proxy] Error during full video recrawl for ${key}:`, e);
                }

                currentChannel.videos = currentChannel.videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey] = currentChannel;

                channelUpdatedThisCycle = true;
            }

            unsafeWindow.HolodexProxyDetails.lastChannelDataUpdate = currentTimestamp;
            localStorage.setItem("HolodexProxyDetails", JSON.stringify(proxyDetails));
            console.log("[Holodex Proxy] Channel/archive data update complete.");
        } 
        else {
            const nextUpdateMin = Math.round((DELAY_BETWEEN_CHANNEL_DATA_UPDATES - (currentTimestamp - proxyDetails.lastChannelDataUpdate)) / (1000 * 60));
            console.log(`[Holodex Proxy] Channel/archive data is up to date. Next check in ${nextUpdateMin} minutes.`);
        }

        for (let video of unsafeWindow.HolodexProxyDetails.streamsData) {
            if (!video.channel.id.startsWith("UC")) continue;
            console.log(`[Holodex Proxy] Updating video data for ${video.id} from ${video.channel.id} (${video.channel.name})`);

            if (!(video.channel.id in unsafeWindow.HolodexProxyDetails.channelsData)) {
                unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id] = {
                    channelData: {},
                    videos: []
                }
            }

            const index = unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos.findIndex(v => v.id === video.id);
            if (index !== -1) {
                unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos[index] = video;
            }
            else {
                unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos.push(video);
            }
        }

        unsafeWindow.HolodexProxyVideoTemp = [];
        for (let key in unsafeWindow.HolodexProxyDetails.channelsData) {
            unsafeWindow.HolodexProxyDetails.channelsData[key].videos = unsafeWindow.HolodexProxyDetails.channelsData[key].videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
            unsafeWindow.HolodexProxyVideoTemp = unsafeWindow.HolodexProxyVideoTemp.concat(unsafeWindow.HolodexProxyDetails.channelsData[key].videos);
        }
        localStorage.setItem("HolodexProxyDetails", JSON.stringify(unsafeWindow.HolodexProxyDetails));
        console.log(`[Holodex Proxy] Scheduling next update check in ${DELAY_BETWEEN_UPCOMING_UPDATES / 1000} seconds.`);
        updateTimeout = setTimeout(() => updateData(false), DELAY_BETWEEN_UPCOMING_UPDATES);
    }

    // --- Thumbnail Replacement Logic ---
    function transform(img) {
        if (!img || !img.src) return;

        const imgSrcParts = img.src.split("/statics/channelImg/");
        if (imgSrcParts.length < 2) {
            return; // No valid image source, exit early
        }

        const mode = imgSrcParts[1].startsWith("UC") ? "youtube" : "twitch";

        // Iterate through the *runtime* ChannelInfos
        for (let key in ChannelInfos) {
            if (img.src.includes(ChannelInfos[key][mode])) {
                img.src = ChannelInfos[key].thumbnail;
                break;
            }
        }
    }

    // --- Mutation Observer ---
    const observer = new MutationObserver((mutations) => {
        for (const { addedNodes } of mutations) {
            for (const addedNode of addedNodes) {
                if (addedNode.nodeType !== 1) continue;
                const imgs = addedNode.querySelectorAll('img');
                for (const img of imgs) {
                    transform(img);
                }
                if (addedNode.tagName === 'IMG') {
                    transform(addedNode);
                }
            }
        }
    });

    // Observe the documentElement for wider coverage
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // --- Initial Data Update Trigger ---
    console.log("[Holodex Proxy] Initializing...");
    updateData(true); // Force update on first run

})();