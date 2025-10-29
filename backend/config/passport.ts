import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { supabase } from '../db';
import { generateAccessToken, generateRefreshToken } from '../utils/auth';

// =====================================================
// Passport Configuration
// =====================================================

// Google OAuth Strategy (only initialize if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth profile:', profile);
    
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const firstName = profile.name?.givenName || '';
    const lastName = profile.name?.familyName || '';
    const displayName = profile.displayName || `${firstName} ${lastName}`.trim();
    const avatarUrl = profile.photos?.[0]?.value;

    if (!email) {
      return done(new Error('No email found in Google profile'), undefined);
    }

    // Check if user exists by Google ID
    let { data: existingUser, error: googleUserError } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();

    if (googleUserError && googleUserError.code !== 'PGRST116') {
      console.error('Error checking Google user:', googleUserError);
      return done(googleUserError, undefined);
    }

    // If user exists with Google ID, update their info
    if (existingUser) {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          avatar_url: avatarUrl,
          display_name: displayName,
          updated_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Error updating Google user:', updateError);
        return done(updateError, undefined);
      }

      return done(null, existingUser);
    }

    // Check if user exists by email (for linking existing accounts)
    const { data: emailUser, error: emailUserError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (emailUserError && emailUserError.code !== 'PGRST116') {
      console.error('Error checking email user:', emailUserError);
      return done(emailUserError, undefined);
    }

    // If user exists with email, link Google account
    if (emailUser) {
      const { error: linkError } = await supabase
        .from('users')
        .update({
          google_id: googleId,
          avatar_url: avatarUrl,
          display_name: displayName,
          updated_at: new Date().toISOString(),
          last_login: new Date().toISOString()
        })
        .eq('id', emailUser.id);

      if (linkError) {
        console.error('Error linking Google account:', linkError);
        return done(linkError, undefined);
      }

      return done(null, emailUser);
    }

    // Create new user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        google_id: googleId,
        email: email,
        password_hash: null, // OAuth users don't have passwords
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        avatar_url: avatarUrl,
        email_verified: true, // Google emails are pre-verified
        is_verified: false,
        is_creator: false,
        two_factor_enabled: false
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating Google user:', createError);
      return done(createError, undefined);
    }

    console.log('Created new Google user:', newUser);
    return done(null, newUser);

  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, undefined);
  }
}));
} else {
  console.warn('⚠️  Google OAuth credentials not found. Google login will be disabled.');
  console.warn('   To enable Google OAuth, add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to your .env file');
}

// Serialize user for session (we'll use JWT instead, but Passport requires this)
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session (we'll use JWT instead, but Passport requires this)
passport.deserializeUser(async (id: string, done) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !user) {
      return done(error, null);
    }

    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// =====================================================
// OAuth Helper Functions
// =====================================================

/**
 * Generate JWT tokens for OAuth user
 */
export const generateOAuthTokens = async (user: any) => {
  try {
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      isCreator: user.is_creator
    });

    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token in database
    const { error } = await supabase
      .from('users')
      .update({
        refresh_token: refreshToken,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error storing refresh token:', error);
      throw error;
    }

    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Error generating OAuth tokens:', error);
    throw error;
  }
};

export default passport;
