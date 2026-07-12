document.addEventListener("DOMContentLoaded", () => {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  const header = document.querySelector("header");
  const lastUpdatedEl = document.getElementById("last-updated");
  const body = document.body;

  if (mobileMenuBtn && mobileMenu) {
    const toggleMenu = (forceState) => {
      const showMenu =
        forceState !== undefined
          ? forceState
          : !mobileMenu.classList.contains("is-active");
      if (showMenu) {
        mobileMenu.classList.add("is-active");
        if (header) header.classList.add("menu-open");
        body.classList.add("overflow-hidden");
        mobileMenuBtn.setAttribute("aria-expanded", "true");
      } else {
        mobileMenu.classList.remove("is-active");
        if (header) header.classList.remove("menu-open");
        body.classList.remove("overflow-hidden");
        mobileMenuBtn.setAttribute("aria-expanded", "false");
      }
    };

    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    const mobileNavLinks = mobileMenu.querySelectorAll(".mobile-nav-link");
    mobileNavLinks.forEach((link) => {
      link.addEventListener("click", () => {
        toggleMenu(false);
      });
    });

    mobileMenu.addEventListener("click", (e) => {
      if (e.target === mobileMenu) {
        toggleMenu(false);
      }
    });
  }

  let map;
  const markersMap = new Map();
  const mapContainer = document.getElementById("map");
  const mapFallback = document.getElementById("map-fallback");

  const statTotalNodes = document.getElementById("stat-total-nodes");
  const statAvgBattery = document.getElementById("stat-avg-battery");
  const statActive = document.getElementById("stat-active");

  if (typeof L !== "undefined" && mapContainer) {
    try {
      const penangBounds = L.latLngBounds([5.12, 100.08], [5.6, 100.52]);

      map = L.map("map", {
        center: [5.385, 100.28],
        zoom: 12,
        minZoom: 11,
        maxZoom: 18,
        maxBounds: penangBounds,
        maxBoundsViscosity: 1.0,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 20,
        },
      ).addTo(map);

      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());

      if (mapFallback) {
        mapFallback.style.display = "none";
      }
    } catch (e) {
      console.error("Leaflet initialization failed: ", e);
    }
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatUptime(uptimeSeconds) {
    if (!uptimeSeconds || isNaN(uptimeSeconds)) return "N/A";
    const days = Math.floor(uptimeSeconds / (24 * 3600));
    const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }

  function formatRelativeTime(epochTime) {
    if (!epochTime || isNaN(epochTime)) return "unknown";
    const nowEpoch = Math.floor(Date.now() / 1000);
    const diffSeconds = nowEpoch - epochTime;

    if (diffSeconds < 0) return "just now";
    if (diffSeconds < 60) return "just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  }

  async function fetchRouters() {
    try {
      const response = await fetch("https://mutiaramesh.vercel.app/routers");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();

      if (result && result.data && Array.isArray(result.data)) {
        if (lastUpdatedEl) {
          const lastUpdatedAgo = result.updatedTimestamp
            ? formatRelativeTime(
                Math.floor(new Date(result.updatedTimestamp).getTime() / 1000),
              )
            : "unknown";
          lastUpdatedEl.textContent = `Last Updated: ${lastUpdatedAgo}`;
        }
        updateNetworkStatistics(result.data);
        renderNodesMarkers(result.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error(
        "Error fetching live router data, using fallback data: ",
        error,
      );
    }
  }

  function updateNetworkStatistics(nodes) {
    if (!nodes || nodes.length === 0) return;

    const total = nodes.length;
    if (statTotalNodes) statTotalNodes.textContent = total;

    const totalBattery = nodes.reduce(
      (sum, node) => sum + (node.batteryLevel || 0),
      0,
    );
    const avgBattery = (totalBattery / total).toFixed(1);
    if (statAvgBattery) statAvgBattery.textContent = `${avgBattery}%`;

    const nowEpoch = Math.floor(Date.now() / 1000);
    const activeCount = nodes.filter(
      (node) => nowEpoch - node.lastHeard < 86400,
    ).length;
    if (statActive) statActive.textContent = `${activeCount}/${total}`;
  }

  function renderNodesMarkers(nodes, isCachedFallback = false) {
    if (!map) return;

    markersMap.forEach((marker) => marker.remove());
    markersMap.clear();

    nodes.forEach((node) => {
      const lat = parseFloat(node.latitude);
      const lng = parseFloat(node.longitude);
      if (
        isNaN(lat) ||
        isNaN(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        console.warn(
          `Invalid coordinates for node ${node.longName}, skipping.`,
        );
        return;
      }

      const isOnline =
        !isCachedFallback &&
        Math.floor(Date.now() / 1000) - node.lastHeard < 86400;

      const pulsingIcon = L.divIcon({
        className: "relative",
        html: `
          <div class="pulsing-marker-ring" style="border-color: ${isOnline ? "#10b981" : "#ef4444"};"></div>
          <div class="pulsing-marker-dot" style="background-color: ${isOnline ? "#10b981" : "#ef4444"}; box-shadow: 0 0 8px ${isOnline ? "rgba(16,185,129,0.8)" : "rgba(239,68,68,0.8)"};"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([lat, lng], { icon: pulsingIcon }).addTo(map);

      const safeLongName = escapeHtml(node.longName);
      const safeShortName = escapeHtml(node.shortName);
      const safeBattery = escapeHtml(String(node.batteryLevel));
      const safeVoltage = escapeHtml(
        typeof node.voltage === "number" ? node.voltage.toFixed(3) : "N/A",
      );
      const safeUptime = escapeHtml(formatUptime(node.uptimeSeconds));
      const safeLastHeard = escapeHtml(
        isCachedFallback ? "cached data" : formatRelativeTime(node.lastHeard),
      );

      const popupContent = `
        <div style="padding:12px;font-size:14px;min-width:200px;font-family:'Inter',sans-serif;">
          <div style="font-family:'Outfit',sans-serif;font-weight:800;color:#fff;font-size:15px;margin-bottom:4px;">${safeLongName}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="padding:2px 6px;border-radius:4px;background:rgba(6,78,59,0.4);color:#34d399;font-family:monospace;font-size:11px;">${safeShortName}</span>
            <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${isOnline ? "#34d399" : "#f87171"};">
              ${isOnline ? "Active" : isCachedFallback ? "Cached" : "Inactive"}
            </span>
          </div>
          <div style="border-top:1px solid rgba(64,64,64,0.5);padding-top:8px;display:grid;gap:6px;font-size:12px;color:#d4d4d4;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#737373;">Battery</span>
              <span style="font-weight:600;color:#fff;font-family:monospace;">${safeBattery}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#737373;">Voltage</span>
              <span style="font-weight:600;color:#fff;font-family:monospace;">${safeVoltage}V</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#737373;">Uptime</span>
              <span style="font-weight:600;color:#e5e5e5;font-family:monospace;">${safeUptime}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#737373;">Last Heard</span>
              <span style="font-weight:600;color:#34d399;font-family:monospace;">${safeLastHeard}</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: L.point(0, -6),
      });

      markersMap.set(node.longName, marker);
    });
  }

  fetchRouters();

  const inviteUrl =
    "https://meshtastic.org/e/?add=true#CjMSINdl0ChJsFPmHHd9_dbwsZC9yAnksgaTBRvFSWK72EuKGgtNdXRpYXJhTWVzaDoCCCASGggBEAQY-gEgCygFOBFAB0gBUBtYCWgByAYB";

  function setupClipboardCopy(buttonId, successHtml) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    const originalClasses = [...btn.classList];

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(inviteUrl);
        const originalHtml = btn.innerHTML;
        btn.innerHTML = successHtml;

        btn.classList.add("bg-emerald-500");
        btn.classList.remove(
          "bg-emerald-400",
          "hover:bg-emerald-300",
          "bg-white/5",
          "hover:bg-white/10",
        );

        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.className = "";
          originalClasses.forEach((cls) => btn.classList.add(cls));
        }, 2000);
      } catch (err) {
        try {
          const textArea = document.createElement("textarea");
          textArea.value = inviteUrl;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);

          const originalHtml = btn.innerHTML;
          btn.innerHTML = successHtml;
          setTimeout(() => {
            btn.innerHTML = originalHtml;
          }, 2000);
        } catch (fallbackErr) {
          console.error("Failed to copy to clipboard: ", fallbackErr);
        }
      }
    });
  }

  setupClipboardCopy(
    "copyChannelBtnSecondary",
    '<span class="text-neutral-950 font-bold">Copied!</span>',
  );
  setupClipboardCopy(
    "copyChannelBtnBody",
    `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
    <span>Copied!</span>
  `,
  );

  const form = document.getElementById("reportForm");
  const submitBtn = document.getElementById("submitBtn");
  const statusDiv = document.getElementById("status");

  const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  function sanitizeInput(str) {
    if (typeof str !== "string") return "";
    return str.trim().replace(/<[^>]*>/g, "");
  }

  const showStatus = (text, type) => {
    if (!statusDiv) return;
    statusDiv.classList.remove(
      "hidden",
      "flex",
      "text-emerald-400",
      "text-red-400",
      "text-neutral-400",
    );
    statusDiv.classList.add("flex");

    let icon = "";
    if (type === "success") {
      statusDiv.classList.add("text-emerald-400");
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    } else if (type === "error") {
      statusDiv.classList.add("text-red-400");
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    } else {
      statusDiv.classList.add("text-neutral-400");
      icon = `<svg class="animate-spin h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    }

    statusDiv.innerHTML = `${icon}<span>${text}</span>`;
  };

  const dropZone = document.getElementById("dropZone");
  const imageInput = document.getElementById("image");
  const uploadPrompt = document.getElementById("uploadPrompt");
  const previewWrapper = document.getElementById("previewWrapper");
  const imagePreview = document.getElementById("imagePreview");
  const removeImageBtn = document.getElementById("removeImageBtn");
  const fileNameEl = document.getElementById("fileName");

  function clearImageFile() {
    if (imageInput) imageInput.value = "";
    if (imagePreview) imagePreview.src = "";
    if (previewWrapper) previewWrapper.classList.add("hidden");
    if (uploadPrompt) uploadPrompt.classList.remove("hidden");
    if (fileNameEl) fileNameEl.textContent = "";
  }

  if (
    dropZone &&
    imageInput &&
    uploadPrompt &&
    previewWrapper &&
    imagePreview &&
    removeImageBtn
  ) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        (e) => {
          e.preventDefault();
          dropZone.classList.add(
            "border-emerald-400/40",
            "bg-emerald-500/[0.03]",
          );
        },
        false,
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        (e) => {
          e.preventDefault();
          dropZone.classList.remove(
            "border-emerald-400/40",
            "bg-emerald-500/[0.03]",
          );
        },
        false,
      );
    });

    dropZone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        imageInput.files = files;
        handleFileSelect(files[0]);
      }
    });

    imageInput.addEventListener("change", (e) => {
      if (imageInput.files.length > 0) {
        handleFileSelect(imageInput.files[0]);
      }
    });

    function handleFileSelect(file) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showStatus("Invalid file type. Use JPEG, PNG, WebP, or GIF.", "error");
        clearImageFile();
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        showStatus("Image is too large (max 5 MB).", "error");
        clearImageFile();
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        uploadPrompt.classList.add("hidden");
        previewWrapper.classList.remove("hidden");

        const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
        fileNameEl.textContent = `${file.name} (${sizeInMb} MB)`;
      };
      reader.readAsDataURL(file);
    }

    removeImageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearImageFile();
    });
  }

  if (form && submitBtn && statusDiv) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nameEl = document.getElementById("name");
      const contactEl = document.getElementById("contactInput");
      const messageEl = document.getElementById("message");

      if (!nameEl || !contactEl || !messageEl) {
        showStatus("Form fields not found.", "error");
        return;
      }

      const name = sanitizeInput(nameEl.value);
      const contact = sanitizeInput(contactEl.value);
      const message = sanitizeInput(messageEl.value);

      if (!name || name.length === 0) {
        showStatus("Please enter your name.", "error");
        nameEl.focus();
        return;
      }
      if (!contact || contact.length === 0) {
        showStatus("Please enter your contact info.", "error");
        contactEl.focus();
        return;
      }
      if (!message || message.length === 0) {
        showStatus("Please enter a message.", "error");
        messageEl.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-neutral-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Sending...</span>
      `;
      showStatus("Transmitting signal report...", "loading");

      const payload = {
        name: name,
        contact: contact,
        message: message,
      };

      const imageFile = imageInput ? imageInput.files[0] : null;

      const sendPayload = async () => {
        try {
          const response = await fetch(
            "https://mutiaramesh.surgelee69.workers.dev/report",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            },
          );

          let data;
          try {
            data = await response.json();
          } catch {
            data = { error: "Invalid server response" };
          }

          if (response.ok) {
            showStatus(
              data.message || "Report transmitted successfully!",
              "success",
            );
            form.reset();
            clearImageFile();
          } else {
            showStatus(
              data.error || `Server returned ${response.status}`,
              "error",
            );
          }
        } catch (error) {
          console.error("Fetch error:", error);
          showStatus("Network timeout. Mesh link unavailable.", "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <span>Send</span>
          `;
        }
      };

      if (imageFile) {
        if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
          showStatus(
            "Invalid file type. Use JPEG, PNG, WebP, or GIF.",
            "error",
          );
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <span>Send</span>
          `;
          return;
        }

        if (imageFile.size > MAX_FILE_SIZE) {
          showStatus("Image is too large (max 5 MB).", "error");
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <span>Send</span>
          `;
          return;
        }

        const reader = new FileReader();

        reader.onloadend = () => {
          payload.image = reader.result;
          sendPayload();
        };

        reader.onerror = () => {
          showStatus("Failed to read image file.", "error");
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <span>Send</span>
          `;
        };

        reader.readAsDataURL(imageFile);
      } else {
        sendPayload();
      }
    });
  }
});
