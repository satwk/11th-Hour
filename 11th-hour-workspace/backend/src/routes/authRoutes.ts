import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { User } from '../models/User';

const router = Router();

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// GET /api/auth/google - Generates the Google auth URL and redirects the user
router.get('/google', (req: Request, res: Response) => {
  try {
    const firebaseId = (req.query.firebaseId as string) || 'test-fb-user-123';
    const oauth2Client = getOAuthClient();
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Crucial to get the refresh_token
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: firebaseId,
      prompt: 'consent' // Forces consent screen to always yield refresh_token
    });

    res.redirect(authUrl);
  } catch (error: any) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).send('Failed to initiate Google authorization.');
  }
});

// GET /api/auth/google/callback - Handles Google OAuth redirect, exchanges code for tokens, and saves them
router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  const firebaseId = req.query.state as string;

  if (!code) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { background-color: #0c0d0e; color: #f7f8f8; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { text-align: center; border: 1px solid #222326; background-color: #0f1011; padding: 2.5rem; border-radius: 8px; max-width: 400px; }
            .logo { width: 48px; height: 48px; background-color: #ef4444; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5rem; margin: 0 auto 1.5rem; }
            h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
            p { font-size: 0.875rem; color: #8a8f98; line-height: 1.5; margin-bottom: 2rem; }
            .btn { display: inline-block; background-color: #ef4444; color: white; text-decoration: none; font-size: 0.875rem; font-weight: 500; padding: 0.625rem 1.25rem; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">!</div>
            <h1>Authorization Code Missing</h1>
            <p>Google authentication failed because no code was returned. Please try again.</p>
            <a href="http://localhost:5173/sync" class="btn">Go Back</a>
          </div>
        </body>
      </html>
    `);
    return;
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error('No access token returned from Google.');
    }

    // Save access token, refresh token, and set sync to true
    const updateData: any = {
      googleAccessToken: tokens.access_token,
      calendarSyncEnabled: true
    };

    if (tokens.refresh_token) {
      updateData.googleRefreshToken = tokens.refresh_token;
    }

    await User.findOneAndUpdate(
      { firebaseId: firebaseId || 'test-fb-user-123' },
      updateData,
      { new: true, upsert: true }
    );

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { background-color: #0c0d0e; color: #f7f8f8; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { text-align: center; border: 1px solid #222326; background-color: #0f1011; padding: 2.5rem; border-radius: 8px; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            .logo { width: 48px; height: 48px; background-color: #5e6ad2; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5rem; margin: 0 auto 1.5rem; box-shadow: 0 4px 10px rgba(94,106,210,0.3); }
            h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
            p { font-size: 0.875rem; color: #8a8f98; line-height: 1.5; margin-bottom: 2rem; }
            .btn { display: inline-block; background-color: #5e6ad2; color: white; text-decoration: none; font-size: 0.875rem; font-weight: 500; padding: 0.625rem 1.25rem; border-radius: 6px; transition: background-color 0.2s; }
            .btn:hover { background-color: #828fff; }
          </style>
          <script>
            setTimeout(() => {
              window.location.href = "http://localhost:5173/sync";
            }, 3000);
          </script>
        </head>
        <body>
          <div class="container">
            <div class="logo">11</div>
            <h1>Google Calendar Connected</h1>
            <p>Your Google Calendar connection is secure. You can close this window or you will be redirected back to the sync page in a few seconds.</p>
            <a href="http://localhost:5173/sync" class="btn">Return to Workspace</a>
          </div>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { background-color: #0c0d0e; color: #f7f8f8; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { text-align: center; border: 1px solid #222326; background-color: #0f1011; padding: 2.5rem; border-radius: 8px; max-width: 400px; }
            .logo { width: 48px; height: 48px; background-color: #ef4444; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5rem; margin: 0 auto 1.5rem; }
            h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
            p { font-size: 0.875rem; color: #8a8f98; line-height: 1.5; margin-bottom: 2rem; }
            .btn { display: inline-block; background-color: #5e6ad2; color: white; text-decoration: none; font-size: 0.875rem; font-weight: 500; padding: 0.625rem 1.25rem; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">X</div>
            <h1>Authentication Failed</h1>
            <p>We could not securely exchange Google auth credentials. Reason: ${error.message || error}</p>
            <a href="http://localhost:5173/sync" class="btn">Return to Workspace</a>
          </div>
        </body>
      </html>
    `);
  }
});

export default router;
