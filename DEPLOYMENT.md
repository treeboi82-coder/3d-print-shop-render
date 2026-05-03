# Deployment Guide for 3D Print Shop

## Overview
The application consists of:
- **Frontend**: React app
- **Backend**: Node.js server

## Render Deployment (Recommended)

The easiest way to deploy the entire application (both frontend and backend) is using Render with the provided `render.yaml` configuration file.

### Step 1: Connect your GitHub repository to Render

1. Go to [render.com](https://render.com)
2. Sign up or log in
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Select the repository containing your project
6. Render will automatically detect the `render.yaml` file

### Step 2: Deploy

1. Review the configuration in the blueprint
2. Click "Apply" to deploy
3. Render will automatically deploy both services:
   - **3dprintshop-backend**: Node.js server
   - **3dprintshop-frontend**: React app

### Step 3: Access your application

After deployment completes:
- Frontend URL: `https://3dprintshop-frontend.onrender.com`
- Backend URL: `https://3dprintshop-backend.onrender.com`
- Dashboard: `https://3dprintshop-frontend.onrender.com/dashboard`

## Manual Deployment

### Backend Deployment (Render)

1. **Create a Render account**
   - Go to [render.com](https://render.com)
   - Sign up and create a new Web Service

2. **Configure the service**
   - Connect your GitHub repository
   - Build command: `npm install`
   - Start command: `node server-clean.cjs`
   - Add environment variables:
     - `PORT`: `4242` (Render will override this)
     - `JWT_SECRET`: (generate a secure random string)
     - `ADMIN_USERNAME`: `3d print shop admin`
     - `ADMIN_PASSWORD`: `3dprintshopadmin@#`

3. **Deploy**
   - Click "Create Web Service"
   - Render will provide a URL like `https://your-backend.onrender.com`

### Frontend Deployment (Render)

1. **Create a new Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Add environment variable:
     - `VITE_API_BASE_URL`: Your backend URL (e.g., `https://your-backend.onrender.com`)

2. **Deploy**
   - Click "Create Web Service"
   - Render will provide a URL like `https://your-frontend.onrender.com`

## Important Notes

### File Persistence
The backend uses JSON files (`orders.json`, `login-logs.json`) for data storage. Render provides persistent file storage for web services.

### Security
- Change the JWT_SECRET to a secure random string in production
- Change the admin password to a strong password in production
- Use environment variables for sensitive data

### CORS
The backend has CORS enabled with wildcard (`*`) for development. In production, you may want to restrict this to your frontend domain.

## After Deployment

1. **Test the Application**
   - Visit your frontend URL
   - Try creating an order
   - Access the dashboard at `/dashboard`

2. **Dashboard Login**
   - Username: `3d print shop admin`
   - Password: `3dprintshopadmin@#`

## Troubleshooting

### Backend not responding
- Check the backend logs in Render
- Ensure the PORT environment variable is set
- Verify environment variables are set correctly

### Frontend can't connect to backend
- Check if `VITE_API_BASE_URL` is set correctly
- Verify CORS settings in the backend
- Check if the backend is running

### File upload issues
- Ensure file size limits are appropriate (50MB max)
- Check if the uploads directory exists on the server
- Verify file permissions
