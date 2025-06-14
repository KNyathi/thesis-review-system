# Thesis Review System - Frontend

## Overview

This frontend application is developed using React.js with modern UI components, Tailwind CSS for styling, and Axios for API requests. It provides a sleek, minimalistic user interface for the Thesis Review System with a modern dark theme, allowing users to register, log in, and interact with the system based on their roles (Student/Reviewer).

## Technology Stack

- **React.js** - Frontend framework
- **React Router DOM** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **React Icons** - Modern icon library (Feather Icons)
- **Axios** - HTTP client for API requests
- **PostCSS & Autoprefixer** - CSS processing and vendor prefixes

# Setup Instructions

### 1. Clone the Repository

To get started, clone the repository using the following command:

```shell
git clone ...
```

### 2. Environment Setup
Ensure you have Node.js and npm installed on your machine. The frontend is configured to run on port 3000 by default.

### 3. Install Dependencies
Navigate to the project directory and install the necessary dependencies:

```shell
cd thesis-review-system/client
npm install
```

### 4. Run the Application 

To start the application in development mode, use:

```shell
npm start
```

This will start the development server and open the application in your default web browser at http://localhost:3000.

### 5. API Endpoints

The frontend interacts with the backend API endpoints for various functionalities such as authentication, profile management, and thesis handling. Below are the key interactions:

Auth Routes:

- Register: POST /api/v1/auth/register
- Login: POST /api/v1/auth/login

### And there is more to be added soon, this project is still work in progress.