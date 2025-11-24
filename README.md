# QR Code Reception App

A static, browser-based application for managing event attendance using QR codes. This app allows event staff to scan user QR codes, check them in, and award scores or coins.

## Features

- **QR Code Scanning**: Instantly scan user QR codes to retrieve their information.
- **Event Selection**: Choose the active event from a list of available events.
- **Check-in Management**:
    - **Registered Users**: Confirm attendance and optionally add scores/coins.
    - **Unregistered Users**: Register them on the spot and then check them in.
    - **Already Attended**: View check-in time for users who have already entered.
- **Score & Coin Awards**: Configure default score and coin values to be awarded upon check-in.
- **Manual Entry**: Fallback option to manually enter User IDs if scanning fails.
- **API Configuration**: Easily configure the API endpoint and API Key via the UI.

## Setup & Usage

### 1. Deployment
Since this is a static application, it can be deployed to any static hosting service (e.g., GitHub Pages, Vercel, Netlify) or run locally.

**Requirements:**
- **HTTPS**: The application requires camera access for QR scanning, which is only allowed over HTTPS (or `localhost`).
- **CORS**: The API server must be configured to allow Cross-Origin Resource Sharing (CORS) requests from the domain where this app is hosted.

### 2. Initial Configuration
On the first launch, you will be prompted to enter the API connection details:
- **API Base URL**: The base URL of your backend API (e.g., `https://api.yourdomain.com`).
- **API Key**: A valid Bearer token or API key with permissions to read users/events and write bookings/scores.

*Note: These settings are saved in your browser's Local Storage. You can update them anytime by clicking the "Settings" (Gear) icon in the header.*

### 3. Running the Reception
1.  **Select Event**: Choose the current event from the dropdown menu. Only events ending within the last 24 hours or in the future are shown.
2.  **Set Defaults (Optional)**: Enter default values for "Default Score" and "Default Coin" if you want to award points automatically during check-in.
3.  **Scan**: Point the camera at a user's QR code.
4.  **Confirm**:
    - If the user is valid, a modal will appear.
    - Verify the information and click **"Confirm Check-in"**.
    - If the user is not registered, click **"Register Now"** first.

## Development

To run locally:
1.  Clone the repository.
2.  Open `reception_page/index.html` in your browser.
    - *Tip: Use a local server (e.g., VS Code Live Server) to avoid file protocol restrictions.*

## Tech Stack
- HTML5 / CSS3 / Vanilla JavaScript
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) for QR code scanning.
- FontAwesome for icons.
- Google Fonts (Inter).
