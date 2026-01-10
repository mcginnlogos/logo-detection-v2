// Boolean toggles to determine which auth types are allowed
const allowOauth = true;
const allowEmail = false;
const allowPassword = false;

// Boolean toggle to determine whether auth interface should route through server or client
// (Currently set to false because screen sometimes flickers with server redirects)
const allowServerRedirect = false;

// Check that OAuth is enabled since we're only using Google auth
if (!allowOauth)
  throw new Error('OAuth must be enabled for Google authentication');

export const getAuthTypes = () => {
  return { allowOauth, allowEmail, allowPassword };
};

export const getViewTypes = () => {
  // Only OAuth sign in is supported
  return ['oauth_signin'];
};

export const getDefaultSignInView = (preferredSignInView: string | null) => {
  // Since we only support OAuth (Google), redirect to OAuth sign in
  return 'oauth_signin';
};

export const getRedirectMethod = () => {
  return allowServerRedirect ? 'server' : 'client';
};
