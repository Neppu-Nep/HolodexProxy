// ==UserScript==
// @name         Custom Holodex Proxy
// @version      0.7.4
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

(async function () {
    'use strict';

    // --- Default Configuration (Used if no settings saved) ---
    const DEFAULT_SETTINGS = {
        youtubeApiKey: "", // YouTube Data API v3 Key
        updateOneChannelAtATime: true, // Update all channels at once or one at a time
        upcomingUpdateDelayMinutes: 10,
        channelDataUpdateDelayHours: 1,
        channelInfos: {
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
                <small style="display: block; margin-top: 5px;">When enabled, only one channel will be updated at a time during the regular background update cycle. This is useful for large channel lists. Forced refreshes update immediately.</small>

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
                    <div style="float: left;">
                         <button type="button" id="hp-export-settings-btn" title="Export current settings to a JSON file">Export</button>
                         <button type="button" id="hp-import-settings-btn" title="Import settings from a JSON file">Import</button>
                         <input type="file" id="hp-import-file-input" style="display: none;" accept=".json">
                    </div>
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
        const exportBtn = modal.querySelector('#hp-export-settings-btn');
        const importBtn = modal.querySelector('#hp-import-settings-btn');
        const importFileInput = modal.querySelector('#hp-import-file-input');

        // State for pagination and sorting
        let currentPage = 1;
        const ITEMS_PER_PAGE = 10;
        let sortDirection = null; // null (default), 'asc', 'desc'

        function renderModalChannelList() {
            if (!listDiv) return;
            listDiv.innerHTML = ''; // Clear previous list

            if (Object.keys(modalChannelInfos).length === 0) {
                listDiv.innerHTML = '<p>No channels configured.</p>';
                return;
            }

            let keys = Object.keys(modalChannelInfos);
            if (sortDirection === 'asc') {
                keys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            }
            else if (sortDirection === 'desc') {
                keys.sort((a, b) => b.toLowerCase().localeCompare(a.toLowerCase()));
            }
            // If sortDirection is null, we use the original order of keys

            const totalItems = keys.length;
            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

            // Ensure currentPage is valid
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;

            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            const pageKeys = keys.slice(startIndex, endIndex);

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';

            // Sort indicator text
            let sortIndicator = '';
            if (sortDirection === 'asc') {
                sortIndicator = ' ▲';
            }
            if (sortDirection === 'desc') {
                sortIndicator = ' ▼';
            }

            table.innerHTML = `
                <thead>
                    <tr>
                        <th id="hp-sort-name-header" style="cursor: pointer; user-select: none; width: 30%;">Name${sortIndicator}</th>
                        <th style="width: 20%;">Twitter</th>
                        <th style="width: 25%;">YouTube</th>
                        <th style="width: 20%;">Twitch</th>
                        <th style="width: 5%; white-space: nowrap;">Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>`;

            const tbody = table.querySelector('tbody');
            for (const name of pageKeys) {
                const info = modalChannelInfos[name];
                const youtubeId = info.youtube || null;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${info.twitter || 'N/A'}</td>
                    <td>${youtubeId || 'N/A'}</td>
                    <td>${info.twitch || 'N/A'}</td>
                    <td>
                        <button class="hp-refresh-channel-btn" data-key="${name}" ${!youtubeId ? 'disabled title="Refresh requires a YouTube ID"' : 'title="Force refresh channel & video data"'}>Refresh</button>
                        <button class="hp-edit-channel-btn" data-key="${name}" title="Edit channel details">Edit</button>
                        <button class="hp-delete-channel-btn" data-key="${name}" title="Remove channel from configuration">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            }
            listDiv.appendChild(table);

            if (totalPages > 1) {
                const paginationDiv = document.createElement('div');
                paginationDiv.style.marginTop = '10px';
                paginationDiv.style.textAlign = 'center';
                paginationDiv.innerHTML = `
                    <button type="button" id="hp-prev-page" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
                    <span style="margin: 0 10px;">Page ${currentPage} of ${totalPages}</span>
                    <button type="button" id="hp-next-page" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
                `;
                listDiv.appendChild(paginationDiv);

                paginationDiv.querySelector('#hp-prev-page').addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        renderModalChannelList();
                    }
                });

                paginationDiv.querySelector('#hp-next-page').addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        renderModalChannelList();
                    }
                });
            }

            table.querySelector('#hp-sort-name-header').addEventListener('click', () => {
                if (sortDirection === null) {
                    sortDirection = 'asc';
                }
                else if (sortDirection === 'asc') {
                    sortDirection = 'desc';
                }
                else {
                    sortDirection = null;
                }
                renderModalChannelList();
            });

            listDiv.querySelectorAll('.hp-refresh-channel-btn').forEach(btn => {
                btn.addEventListener('click', () => handleForceRefreshClick(btn));
            });
            listDiv.querySelectorAll('.hp-edit-channel-btn').forEach(btn => {
                btn.addEventListener('click', () => showModalAddEditForm(btn.dataset.key));
            });
            listDiv.querySelectorAll('.hp-delete-channel-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteModalChannel(btn.dataset.key));
            });
        }

        async function handleForceRefreshClick(button) {
            const key = button.dataset.key;
            const channelInfo = modalChannelInfos[key];
            const youtubeId = channelInfo?.youtube;

            if (!youtubeId) {
                alert("Cannot refresh: This channel does not have a YouTube ID configured.");
                return;
            }

            if (!YOUTUBE_API_KEY) {
                alert("Cannot refresh: YouTube API Key is not set in settings.");
                return;
            }

            button.disabled = true;
            button.textContent = 'Refreshing...';
            button.title = 'Refresh in progress...';

            console.log(`[Holodex Proxy] Force refreshing channel: ${key} (${youtubeId})`);
            try {
                await updateSingleChannelData(youtubeId, key, true);
                alert(`Successfully refreshed data for channel: ${key}`);
                console.log(`[Holodex Proxy] Force refresh complete for channel: ${key}`);
                // Update the global temp video cache and save after refresh
                await rebuildTempVideoCache();
                saveCacheToLocalStorage();
            }
            catch (error) {
                alert(`Error refreshing channel ${key}. Check the console for details.`);
                console.error(`[Holodex Proxy] Error during force refresh for channel ${key}:`, error);
            }
            finally {
                // Re-enable the button regardless of success/failure
                button.disabled = false;
                button.textContent = 'Refresh';
                button.title = 'Force refresh channel & video data';
            }
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

            }
            else { // Adding new
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

            modalChannelInfos[name] = channelData;

            renderModalChannelList();
            hideModalAddEditForm();
            console.log(`[Holodex Proxy] Channel "${name}" added or changed locally in modal.`);
        }

        function deleteModalChannel(key) {
            if (confirm(`Are you sure you want to delete the channel "${key}" from the configuration? This will take effect when you save settings.`)) {
                delete modalChannelInfos[key];
                renderModalChannelList();
                console.log(`[Holodex Proxy] Channel "${key}" marked for deletion locally in modal.`);
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
                updateData(); // Trigger an update check immediately after saving
            } catch (e) {
                console.error("[Holodex Proxy] Error saving settings:", e);
                alert("Error saving settings. See console for details.");
            }
        });

        exportBtn.addEventListener('click', () => {
            const currentModalSettings = {
                youtubeApiKey: "",
                updateOneChannelAtATime: modal.querySelector('#hp-update-one-channel').checked,
                upcomingUpdateDelayMinutes: parseInt(modal.querySelector('#hp-upcoming-delay').value, 10),
                channelDataUpdateDelayHours: parseInt(modal.querySelector('#hp-channel-delay').value, 10),
                channelInfos: modalChannelInfos
            };

            const blob = new Blob([JSON.stringify(currentModalSettings, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "holodex-proxy-settings.json";
            document.body.appendChild(a); // Append to body to ensure click works in all browsers
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        importBtn.addEventListener('click', () => {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedSettings = JSON.parse(event.target.result);

                    // Basic validation/Application
                    if (importedSettings.youtubeApiKey !== undefined) apiKeyInput.value = importedSettings.youtubeApiKey;
                    if (importedSettings.updateOneChannelAtATime !== undefined) modal.querySelector('#hp-update-one-channel').checked = !!importedSettings.updateOneChannelAtATime;
                    if (importedSettings.upcomingUpdateDelayMinutes !== undefined) modal.querySelector('#hp-upcoming-delay').value = importedSettings.upcomingUpdateDelayMinutes;
                    if (importedSettings.channelDataUpdateDelayHours !== undefined) modal.querySelector('#hp-channel-delay').value = importedSettings.channelDataUpdateDelayHours;

                    if (importedSettings.channelInfos && typeof importedSettings.channelInfos === 'object') {
                        modalChannelInfos = importedSettings.channelInfos;
                        renderModalChannelList();
                    }

                    alert("Settings loaded from file! Review them and click 'Save & Apply Settings' to persist.");
                }
                catch (err) {
                    console.error("[Holodex Proxy] Import Error:", err);
                    alert("Failed to import settings. Invalid JSON file.");
                }
                importFileInput.value = ''; // Reset input to allow re-importing same file if needed
            };
            reader.readAsText(file);
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
                border: 1px solid #4a5568; border-radius: 8px; width: 80%;
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
                border: 1px solid #718096; color: #e2e8f0; border-radius: 4px; box-sizing: border-box;
            }
            .hp-form-group input[type="checkbox"] {
                margin-right: 5px; vertical-align: middle;
            }
            .hp-form-group input[type="number"] { width: 100px; }
            #holodex-proxy-settings-modal button {
                background-color: #4a5568; color: #e2e8f0; padding: 8px 15px;
                border: 1px solid #718096; border-radius: 4px; cursor: pointer;
                margin-right: 5px; transition: background-color 0.2s; vertical-align: middle;
            }
            #holodex-proxy-settings-modal button:disabled {
                background-color: #3a4351;
                color: #718096;
                cursor: not-allowed;
                border-color: #4a5568;
            }
            #holodex-proxy-settings-modal button:hover:not(:disabled) { background-color: #718096; }
            #hp-save-settings-btn, #hp-save-channel-btn { background-color: #38a169; }
            #hp-save-settings-btn:hover:not(:disabled), #hp-save-channel-btn:hover:not(:disabled) { background-color: #48bb78; }
            #hp-delete-channel-btn { background-color: #c53030; font-size: 0.8em; padding: 4px 8px; }
            #hp-delete-channel-btn:hover:not(:disabled) { background-color: #e53e3e; }
            .hp-refresh-channel-btn { background-color: #2b6cb0; font-size: 0.8em; padding: 4px 8px; }
            .hp-refresh-channel-btn:hover:not(:disabled) { background-color: #4299e1; }
            .hp-edit-channel-btn { font-size: 0.8em; padding: 4px 8px; }
            .hp-modal-buttons { margin-top: 20px; text-align: right; }
            #hp-channel-list table { border: 1px solid #4a5568; margin-top: 10px; }
            #hp-channel-list th, #hp-channel-list td { padding: 8px; border: 1px solid #4a5568; text-align: left; vertical-align: middle; }
            #hp-channel-list th { background-color: #4a5568; }
            #hp-channel-list td:last-child { white-space: nowrap; width: 1%; }
            #hp-channel-list button { font-size: 0.9em; padding: 4px 8px; margin-left: 3px; margin-right: 3px; }
            #hp-add-edit-form { background-color: #4a5568; border-radius: 5px; }
            hr { border: 0; border-top: 1px solid #4a5568; margin: 20px 0; }
        `);
    }

    GM_registerMenuCommand("Holodex Proxy Settings", createSettingsModal);

    // --- Details Initialization ---
    async function initDetails() {
        let config = null;

        try {
            config = await GM_getValue("HolodexProxyDetails", null);
            console.log("[Holodex Proxy] Loaded cache from GM storage.");
        } catch (e) {
            console.error("[Holodex Proxy] Error reading cache from GM storage, resetting cache:", e);
            config = null;
        }

        if (!config) {
            config = { streamsData: [], channelsData: {}, lastStreamDataUpdate: 0, lastChannelDataUpdate: 0 };
            console.log("[Holodex Proxy] No valid cache found. Creating new cache.");
            await saveCacheToLocalStorage(config);
        }

        unsafeWindow.HolodexProxyVideoTemp = [];
        unsafeWindow.HolodexProxyDetails = config;
        await rebuildTempVideoCache();
    }

    // Helper to save cache consistently
    async function saveCacheToLocalStorage(dataToSave = null) {
        try {
            const cacheData = dataToSave || unsafeWindow.HolodexProxyDetails;
            if (cacheData) {
                await GM_setValue("HolodexProxyDetails", cacheData);
            }
        } catch (e) {
            console.error("[Holodex Proxy] Error saving cache to GM storage:", e);
        }
    }

    // Helper to rebuild the flat temp video cache
    async function rebuildTempVideoCache() {
        unsafeWindow.HolodexProxyVideoTemp = [];
        const proxyDetails = unsafeWindow.HolodexProxyDetails;
        if (!proxyDetails || !proxyDetails.channelsData) return;

        for (let key in proxyDetails.channelsData) {
            if (proxyDetails.channelsData[key] && Array.isArray(proxyDetails.channelsData[key].videos)) {
                // Sort and filter out invalid videos
                proxyDetails.channelsData[key].videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                const validVideos = proxyDetails.channelsData[key].videos.filter(v => v && v.id);
                unsafeWindow.HolodexProxyVideoTemp = unsafeWindow.HolodexProxyVideoTemp.concat(validVideos);
            }
        }

        // Deduplicate just in case, although it shouldn't happen often with proper updates
        const seenIds = new Set();
        unsafeWindow.HolodexProxyVideoTemp = unsafeWindow.HolodexProxyVideoTemp.filter(video => {
            if (!video || !video.id || seenIds.has(video.id)) return false;
            seenIds.add(video.id);
            return true;
        });
        console.log(`[Holodex Proxy] Rebuilt temporary video cache with ${unsafeWindow.HolodexProxyVideoTemp.length} videos.`);

        // Save the cache after rebuilding
        await saveCacheToLocalStorage();
    }


    await initDetails();
    let oldXHROpen = window.XMLHttpRequest.prototype.open;

    window.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {

        // Only intercept requests to Holodex
        if (!url.includes('holodex.net')) {
            return oldXHROpen.apply(this, arguments);
        }

        let customRequestToChannelId = null;
        let customRequestToVideoId = null;
        let parsedUrl = new URL(url);

        // Check if HolodexProxyDetails is loaded
        const proxyDetails = unsafeWindow.HolodexProxyDetails;
        if (!proxyDetails) {
            console.warn("[Holodex Proxy] Proxy details not yet loaded, cannot intercept.");
            return oldXHROpen.apply(this, arguments);
        }

        if (parsedUrl.pathname.includes("/api/v2/channels")) {
            let channelId = parsedUrl.pathname.split("/").pop();
            if (["videos", "clips", "collabs"].includes(channelId)) channelId = parsedUrl.pathname.split("/")[(parsedUrl.pathname.split("/").length - 2)];

            if (proxyDetails.channelsData && channelId in proxyDetails.channelsData) {
                // Ensure this channel is actually in the *current settings*
                const isConfiguredChannel = Object.values(ChannelInfos).some(info => info && info.youtube === channelId);
                if (isConfiguredChannel) {
                    console.log(`[Holodex Proxy] Intercepted request to Custom Channel ID: ${channelId}`);
                    url = url.toString().replace(channelId, "UCp6993wxpyDPHUpavwDFqgg"); // Tokino Sora Channel ID
                    customRequestToChannelId = channelId;
                } else {
                    console.log(`[Holodex Proxy] Channel ${channelId} found in cache but not in current config. Ignoring interception.`);
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

        this.addEventListener("readystatechange", function () {

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
                        const twitchId = ChannelInfos[key]?.twitch;

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

                        // Handle for twitch only channels
                        if (!ytId && twitchId) {
                            // Construct a dummy channel data for twitch only channels
                            favData.push({
                                id: twitchId,
                                name: key,
                                english_name: key,
                                photo: ChannelInfos[key].thumbnail,
                                type: "vtuber",
                                subscriber_count: 0,
                                video_count: 0,
                                clip_count: 0,
                                twitter: "",
                                org: "",
                                inactive: false,
                                group: ""
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
                    Object.defineProperty(this, 'status', { get: () => 200, configurable: true });

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
                            newResponse = { "topic_id": null, "topic_approver_id": null };
                        }
                        else {
                            const videoData = unsafeWindow.HolodexProxyVideoTemp.find(video => video && video.id === customRequestToVideoId);
                            if (!videoData) {
                                console.error(`[Holodex Proxy] Video ${customRequestToVideoId} data missing in temp cache! Returning default video data.`);
                                Object.defineProperty(this, 'status', { get: () => 404, configurable: true });
                            }
                            else {
                                videoData.channel = proxyDetails.channelsData[videoData.channel.id]?.channelData || null;
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

        if (!api_key) {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube video data fetch.");
            return [];
        }
        if (!videoIds || videoIds.length === 0) return []; // Added check for empty array

        let finalResponse = [];
        for (let i = 0; i < videoIds.length; i += 50) {
            const chunk = videoIds.slice(i, i + 50);
            const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,contentDetails&id=${chunk.join(",")}&key=${api_key}`;

            try {
                const videoResponse = await fetch(videoUrl);
                const responseText = await videoResponse.text(); // Get text first for better error logging
                if (!videoResponse.ok) {
                    console.error(`[Holodex Proxy] YouTube API error (${videoResponse.status}) fetching video data chunk ${i / 50}. IDs: ${chunk.join(',')}. Response:`, responseText);
                    continue; // Skip this chunk
                }
                const videoData = JSON.parse(responseText);

                for (const item of videoData.items || []) {
                    const isLive = item.snippet.liveBroadcastContent;

                    if (mode === "stream" && !item.liveStreamingDetails.scheduledStartTime && isLive === "none") {
                        continue;
                    }

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
                        console.log(`[Holodex Proxy] Live stream detected: ${item.id} (${item.snippet.title})`);
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
            }
            catch (error) {
                console.error(`[Holodex Proxy] Error fetching or processing video chunk ${i / 50} (IDs: ${chunk.join(',')}):`, error);
            }
        }
        return finalResponse;
    }


    async function checkYt(channelIds, api_key, limit = true, count = 7, mode = "stream") {

        if (!api_key) {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube playlist fetch.");
            return [];
        }
        if (!channelIds || channelIds.length === 0) return [];

        let videoIds = [];
        const modesToPlaylistPrefix = {
            "videos": "UULF", // Regular uploads (VODs)
            "stream": "UULV", // Seems to be live/upcoming/recent streams
            "membersonly": "UUMO", // Members-only uploads
            "membersonlylive": "UUMV", // Members-only live/upcoming/recent streams
            "shorts": "UUSH", // Shorts
        };

        const playlistPrefix = modesToPlaylistPrefix[mode];
        if (!playlistPrefix) {
            console.error(`[Holodex Proxy] Invalid mode specified for checkYt: ${mode}`);
            return [];
        }

        await Promise.all(channelIds.map(async (channelId) => {
            if (!channelId || !channelId.startsWith("UC")) {
                console.warn(`[Holodex Proxy] Invalid YouTube channel ID provided: ${channelId}. Skipping.`);
                return;
            }
            const channelName = Object.keys(ChannelInfos).find(key => ChannelInfos[key]?.youtube === channelId);
            console.log(`[Holodex Proxy] Fetching youtube data for ${channelName || channelId} (${channelId}) (${mode}) with count ${count}`);
            const playlistId = `${playlistPrefix}${channelId.substring(2)}`;
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
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    async function checkTwitch(channelInfosAndNames) {
        if (!channelInfosAndNames || channelInfosAndNames.length === 0) return [];

        let finalResponse = [];
        await Promise.all(channelInfosAndNames.map(async ([channelInfo, channelName]) => {
            const twitchChannelId = channelInfo.twitch;
            const youtubeChannelId = channelInfo?.youtube;
            console.log(`[Holodex Proxy] Fetching twitch data for ${twitchChannelId}`);
            try {
                const data = await GM_fetch(`https://twitch.tv/${twitchChannelId}`);
                if (!data) {
                    console.warn(`[Holodex Proxy] No data received from Twitch scrape for ${twitchChannelId}`);
                    return;
                }

                if (data.includes("isLiveBroadcast")) {

                    const thumb_url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${twitchChannelId}-1280x720.jpg`;
                    const thumb_data = await fetch(thumb_url);
                    if (thumb_data.redirected) {
                        console.warn(`[Holodex Proxy] ${twitchChannelId} thumbnail doesn't work. Assuming not live.`);
                        return;
                    }

                    let parsedData;
                    try {
                        let firstPart = data.substring(data.indexOf('<script type="application/ld+json">') + 35);
                        const ldJson = JSON.parse(firstPart.substring(0, firstPart.indexOf("</script>")));
                        let graph = ldJson["@graph"];
                        if (!Array.isArray(graph)) graph = graph ? [graph] : [];
                        parsedData = graph.find((n) => n?.publication?.isLiveBroadcast === true)
                            || graph.find((n) => n?.["@type"] === "VideoObject" && n?.publication?.startDate);

                    } catch (parseError) {
                        console.error(`[Holodex Proxy] Error parsing Twitch JSON-LD for ${twitchChannelId}:`, parseError);
                        return;
                    }

                    if (!parsedData?.publication?.startDate) {
                        console.warn(`[Holodex Proxy] ${twitchChannelId} live node not found in JSON-LD. Assuming not live.`);
                        return;
                    }
                    const liveStartDate = parsedData.publication.startDate || parsedData.uploadDate;
                    const liveTitle = parsedData.description || parsedData.name || `${twitchChannelId} live`;
                    if (!liveStartDate) {
                        console.warn(`[Holodex Proxy] ${twitchChannelId} live start date missing. Assuming not live.`);
                        return;
                    }
                    console.log(`[Holodex Proxy] Constructing twitch data for ${twitchChannelId}`);

                    finalResponse.push({
                        id: `hpproxy${generateRandomString(6)}`,
                        title: liveTitle,
                        type: "placeholder",
                        available_at: liveStartDate,
                        duration: 0,
                        status: "live",
                        start_scheduled: liveStartDate,
                        start_actual: liveStartDate,
                        channel: {
                            id: youtubeChannelId || twitchChannelId,
                            name: channelName,
                            org: "Independents",
                            suborg: "",
                            type: "vtuber",
                            photo: "",
                            english_name: channelName,
                        },
                        link: `https://twitch.tv/${twitchChannelId}`,
                        certainty: "certain",
                        thumbnail: thumb_url,
                        placeholderType: "external-stream",
                    });
                }
                else {
                    console.warn(`[Holodex Proxy] ${twitchChannelId} isLiveBroadcast doesn't exist. Assuming not live.`);
                }
            }
            catch (err) {
                console.error(`[Holodex Proxy] Error fetching or processing Twitch data for ${twitchChannelId}:`, err);
            }
        }));
        return finalResponse;
    }

    // --- Single Channel Update Logic (Extracted) ---
    async function updateSingleChannelData(youtubeId, channelName, forceRecrawl = false) {
        if (!youtubeId || !channelName) {
            console.error("[Holodex Proxy] Missing youtubeId or channelName for single channel update.");
            return;
        }

        if (!YOUTUBE_API_KEY) {
            console.error("[Holodex Proxy] Youtube API key is not set. Cannot update channel data.");
            return;
        }

        console.log(`[Holodex Proxy] Updating data for channel: ${channelName} (${youtubeId}), Force Recrawl Channel Data: ${forceRecrawl}`);
        const currentTimestamp = Date.now();
        const proxyDetails = unsafeWindow.HolodexProxyDetails;

        // Initialize cache entry if needed
        if (!(youtubeId in proxyDetails.channelsData)) {
            proxyDetails.channelsData[youtubeId] = { channelData: {}, videos: [] };
            console.log(`[Holodex Proxy] Initialized cache entry for ${channelName}`);
        }
        let currentChannelCache = proxyDetails.channelsData[youtubeId];

        // --- Update Status of Existing Live/Upcoming Videos ---
        const liveOrUpcomingVids = currentChannelCache.videos.filter(video => video && (video.status === "live" || video.status === "upcoming"));
        if (liveOrUpcomingVids.length > 0) {
            console.log(`[Holodex Proxy] Updating status for ${liveOrUpcomingVids.length} cached live/upcoming videos for ${channelName}`);
            try {
                let liveOrUpcomingVidsIds = liveOrUpcomingVids.map(video => video.id);
                const liveOrUpcomingVidsData = await fetchYtVideosData(liveOrUpcomingVidsIds, YOUTUBE_API_KEY, "stream");

                const updatedIds = new Set();
                liveOrUpcomingVidsData.forEach(updatedVideo => {
                    const index = currentChannelCache.videos.findIndex(v => v && v.id === updatedVideo.id);
                    if (index !== -1) {
                        currentChannelCache.videos[index] = updatedVideo;
                    } else {
                        currentChannelCache.videos.push(updatedVideo);
                    }
                    updatedIds.add(updatedVideo.id);
                });

                const removedIds = liveOrUpcomingVidsIds.filter(id => !updatedIds.has(id));
                if (removedIds.length > 0) {
                    console.log(`[Holodex Proxy] Removing ${removedIds.length} videos for ${channelName} that are no longer live/upcoming/available: ${removedIds.join(', ')}`);
                    currentChannelCache.videos = currentChannelCache.videos.filter(v => v && !removedIds.includes(v.id));
                    currentChannelCache.videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                }

            }
            catch (e) {
                console.error(`[Holodex Proxy] Error updating live/upcoming video status for ${channelName}:`, e);
            }
        }

        // --- Update Channel Details & Recrawl Videos (if forced or needed) ---
        const shouldRecrawl = forceRecrawl || !currentChannelCache.channelData?.recrawled_at || (currentTimestamp - new Date(currentChannelCache.channelData.recrawled_at).getTime() > 1000 * 60 * 60 * 24 * 7); // Recrawl every 7 days or if forced

        if (shouldRecrawl) {
            console.log(`[Holodex Proxy] Performing full channel details update and video recrawl for ${channelName}.`);

            // Fetch Channel Details
            try {
                console.log(`[Holodex Proxy] Fetching channel details from YouTube API for ${channelName} (${youtubeId})`);
                let response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,id,snippet,statistics,brandingSettings&id=${youtubeId}&key=${YOUTUBE_API_KEY}`);
                let data = await response.json();

                if (data.items && data.items.length > 0) {
                    currentChannelCache.channelData = {
                        id: youtubeId,
                        name: data.items[0].snippet.title,
                        english_name: data.items[0].snippet.title,
                        description: data.items[0].snippet.description || "",
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
                        twitter: ChannelInfos[channelName].twitter || "",
                        inactive: false,
                        created_at: "",
                        top_topics: [],
                        yt_handle: [data.items[0].snippet.customUrl],
                        twitch: ChannelInfos[channelName].twitch || null,
                        yt_name_history: [],
                        groups: ""
                    };
                    console.log(`[Holodex Proxy] Channel details updated successfully for ${channelName}.`);
                }
                else {
                    console.warn(`[Holodex Proxy] No channel data returned from YouTube API for ${youtubeId}. Channel might be invalid or terminated.`);
                    currentChannelCache.channelData.inactive = true;
                    currentChannelCache.channelData.updated_at = new Date().toISOString();
                    currentChannelCache.channelData.recrawled_at = new Date().toISOString(); // Mark recrawl attempt
                }
            }
            catch (e) {
                console.error(`[Holodex Proxy] Error fetching channel details for ${channelName}:`, e);
            }

            console.log(`[Holodex Proxy] Starting full video recrawl for ${channelName}. This may take time.`);
            let newVideoFetch = [];
            const modesToCrawl = ["stream", "videos", "membersonlylive", "membersonly", "shorts"];
            try {
                const approxVideoCount = parseInt(currentChannelCache.channelData.video_count || "1000", 10);
                let currentTotalCount = 0;
                for (const mode of modesToCrawl) {
                    console.log(`[Holodex Proxy] Fetching ${mode} for ${channelName}...`);
                    const videoData = await checkYt([youtubeId], YOUTUBE_API_KEY, false, approxVideoCount - currentTotalCount, mode);
                    currentTotalCount += videoData.length;

                    console.log(`[Holodex Proxy] Fetched ${videoData.length} videos for mode '${mode}' for ${channelName}.`);
                    newVideoFetch = newVideoFetch.concat(videoData);
                    await new Promise(r => setTimeout(r, 5000));
                }

                // Merge new videos with existing cache, deduplicate, and sort
                let combinedVideos = currentChannelCache.videos.concat(newVideoFetch);
                const seenVideoIds = new Set();
                const uniqueVideos = combinedVideos.filter(video => {
                    if (!video || !video.id || seenVideoIds.has(video.id)) {
                        return false;
                    }
                    seenVideoIds.add(video.id);
                    return true;
                });

                // Sort by available_at descending (most recent first)
                currentChannelCache.videos = uniqueVideos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                console.log(`[Holodex Proxy] Full video recrawl complete for ${channelName}. Total unique videos in cache: ${currentChannelCache.videos.length}`);

            }
            catch (e) {
                console.error(`[Holodex Proxy] Error during full video recrawl for ${channelName}:`, e);
            }
        }
        else {
            console.log(`[Holodex Proxy] Skipping full recrawl for ${channelName} as it's not forced and was recrawled recently.`);
        }

        // --- Final Sort and Update Cache ---
        currentChannelCache.videos = currentChannelCache.videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
        unsafeWindow.HolodexProxyDetails.channelsData[youtubeId] = currentChannelCache;
    }

    let updateTimeout = null;
    async function updateData(force = false, onload = false) {

        if (updateTimeout) {
            clearTimeout(updateTimeout);
            updateTimeout = null;
        }

        const scheduleNextUpdate = () => {
            console.log(`[Holodex Proxy] Scheduling next background update check in ${DELAY_BETWEEN_UPCOMING_UPDATES / 1000} seconds.`);
            updateTimeout = setTimeout(() => updateData(false), DELAY_BETWEEN_UPCOMING_UPDATES);
        };

        const currentTimestamp = Date.now();
        const proxyDetails = unsafeWindow.HolodexProxyDetails;

        // Check if cache exists
        if (!proxyDetails) {
            console.error("[Holodex Proxy] Cache object not found during updateData!");
            await initDetails(); // Re-initialize as a fallback
            if (!unsafeWindow.HolodexProxyDetails) {
                console.error("[Holodex Proxy] Cache initialization failed. Aborting update cycle.");
                return; // Stop if still fails
            }
        }

        // --- Upcoming/Live Update ---
        const timeSinceLastStreamUpdate = currentTimestamp - (proxyDetails.lastStreamDataUpdate || 0);
        if (onload || force || timeSinceLastStreamUpdate > DELAY_BETWEEN_UPCOMING_UPDATES) {
            console.log("[Holodex Proxy] Updating upcoming/live stream data...");

            // Get channels from the *runtime* ChannelInfos variable
            const ytChannels = Object.values(ChannelInfos).map(info => info?.youtube).filter(Boolean);
            const twitchChannels = Object.entries(ChannelInfos)
                .filter(([_, info]) => info?.twitch)
                .map(([name, info]) => [info, name]);

            try {
                let ytUpcomingData = await checkYt(ytChannels, YOUTUBE_API_KEY);
                let ytMembersUpcomingData = await checkYt(ytChannels, YOUTUBE_API_KEY, false, 7, "membersonlylive");
                let twitchData = await checkTwitch(twitchChannels);

                let combinedData = ytUpcomingData.concat(ytMembersUpcomingData).concat(twitchData);
                let finalData = combinedData.filter(video => video && (video.duration === 0));

                unsafeWindow.HolodexProxyDetails.streamsData = finalData;
                console.log(`[Holodex Proxy] Live/Upcoming update complete. Found ${finalData.length} items.`);
            }
            catch (e) {
                console.error("[Holodex Proxy] Error during live/upcoming fetch:", e);
            }
            finally {
                unsafeWindow.HolodexProxyDetails.lastStreamDataUpdate = currentTimestamp;
            }

        }
        else {
            const nextUpdateSec = Math.round((DELAY_BETWEEN_UPCOMING_UPDATES - timeSinceLastStreamUpdate) / 1000);
            console.log(`[Holodex Proxy] Upcoming/live stream data is up to date. Next check in ${nextUpdateSec} seconds.`);
        }

        // --- Channel & Archive Update Cycle ---
        const timeSinceLastChannelUpdateCycle = currentTimestamp - (proxyDetails.lastChannelDataUpdate || 0);
        if (force || timeSinceLastChannelUpdateCycle > DELAY_BETWEEN_CHANNEL_DATA_UPDATES) {
            console.log(`[Holodex Proxy] Starting channel/archive update cycle check (Force: ${force}). Cycle Interval: ${DELAY_BETWEEN_CHANNEL_DATA_UPDATES / (60 * 1000)} min.`);

            // Remove inactive channels from cache (based on current ChannelInfos) before updating
            const activeYoutubeIds = new Set(Object.values(ChannelInfos).map(info => info?.youtube).filter(Boolean));
            let channelsRemoved = 0;
            for (let cachedYtId in proxyDetails.channelsData) {
                if (!activeYoutubeIds.has(cachedYtId)) {
                    console.log(`[Holodex Proxy] Removing inactive channel ${cachedYtId} from cache.`);
                    delete proxyDetails.channelsData[cachedYtId];
                    channelsRemoved++;
                }
            }

            if (channelsRemoved > 0) {
                console.log(`[Holodex Proxy] Removed ${channelsRemoved} inactive channels from cache.`);
                await rebuildTempVideoCache(); // Rebuild flat cache if channels were removed
            }

            let channelUpdatedThisCycle = false; // Track if any channel was updated this cycle

            // Iterate through the *runtime* ChannelInfos
            const channelNames = Object.keys(ChannelInfos);
            for (const channelName of channelNames) {

                const youtubeId = ChannelInfos[channelName]?.youtube;
                if (!youtubeId) {
                    continue;
                }

                if (UpdateOneChannelAtATime && !force && channelUpdatedThisCycle) {
                    console.log("[Holodex Proxy] 'Update One Channel at a Time' is enabled, stopping cycle after one update.");
                    break;
                }

                console.log(`[Holodex Proxy] Checking channel ${channelName} (${youtubeId}) for updates...`);

                // Check individual channel's last update time *within its cache entry*
                const channelCache = proxyDetails.channelsData[youtubeId];
                const lastChannelRecrawlTime = channelCache?.channelData?.recrawled_at ? new Date(channelCache.channelData.recrawled_at).getTime() : 0;
                const needsUpdate = !lastChannelRecrawlTime || (currentTimestamp - lastChannelRecrawlTime > 1000 * 60 * 60 * 24 * 7); // Needs update if never crawled or older than 7 days

                // If forced, update regardless of time. If not forced, update only if needed.
                if (force || needsUpdate) {
                    try {
                        // Use the separated function. Pass `force` to ensure recrawl happens if `force` is true.
                        await updateSingleChannelData(youtubeId, channelName, force || needsUpdate);
                        channelUpdatedThisCycle = true;
                        if (channelNames.length > 1) {
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                    catch (e) {
                        console.error(`[Holodex Proxy] Error in update cycle for channel ${channelName}:`, e);
                    }
                }
                else {
                    console.log(`[Holodex Proxy] Channel ${channelName} (${youtubeId}) archive data hasn't passed 24 hours yet. Skipping update in this cycle.`);
                    // Still update the live/upcoming status for this channel even if not recrawling
                    try {
                        await updateSingleChannelData(youtubeId, channelName, false);
                    }
                    catch (e) {
                        console.error(`[Holodex Proxy] Error updating live/upcoming status for ${channelName}:`, e);
                    }
                }
            }

            unsafeWindow.HolodexProxyDetails.lastChannelDataUpdate = currentTimestamp;
            console.log("[Holodex Proxy] Channel/archive data update cycle finished.");

        }
        else {
            const nextUpdateMin = Math.round((DELAY_BETWEEN_CHANNEL_DATA_UPDATES - timeSinceLastChannelUpdateCycle) / (1000 * 60));
            console.log(`[Holodex Proxy] Channel/archive data update cycle not due yet. Next check in ${nextUpdateMin} minutes.`);
            console.log("[Holodex Proxy] Performing quick status update for live/upcoming videos in channel caches...");
            for (const channelName in ChannelInfos) {
                const youtubeId = ChannelInfos[channelName]?.youtube;
                if (youtubeId && proxyDetails.channelsData[youtubeId]) {
                    try {
                        await updateSingleChannelData(youtubeId, channelName, false);
                    }
                    catch (e) {
                        console.error(`[Holodex Proxy] Error during quick status update for ${channelName}:`, e);
                    }
                }
            }
            console.log("[Holodex Proxy] Quick status update finished.");
        }

        // --- Final Cache Consolidation ---
        // Ensure any newly fetched live/upcoming streams are reflected in the channel's video list
        for (let liveVideo of unsafeWindow.HolodexProxyDetails.streamsData) {
            if (!liveVideo.channel || !liveVideo.channel.id || !liveVideo.channel.id.startsWith("UC")) continue;

            const channelId = liveVideo.channel.id;
            if (!proxyDetails.channelsData[channelId]) {
                console.warn(`[Holodex Proxy] Channel ${channelId} not found in cache. Initializing new entry.`);
                proxyDetails.channelsData[channelId] = { channelData: {}, videos: [] };
            }
            const channelVidCache = unsafeWindow.HolodexProxyDetails.channelsData[channelId].videos;
            const index = channelVidCache.findIndex(v => v && v.id === liveVideo.id);
            if (index !== -1) {
                channelVidCache[index] = liveVideo;
            }
            else {
                channelVidCache.push(liveVideo);
                channelVidCache.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
            }
        }

        // Rebuild the flat temporary video cache from the updated channel data
        await rebuildTempVideoCache();

        // Save the entire updated cache to storage
        await saveCacheToLocalStorage();

        // Schedule the next background check
        scheduleNextUpdate();
    }


    // --- Thumbnail Replacement Logic ---
    function transform(img) {
        if (!img || !img.src || !img.src.includes('/statics/channelImg/')) return;

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
    updateData(false, true);

})();