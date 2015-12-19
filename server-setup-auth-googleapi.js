var path     = require('path') ;
var fs       = require('fs') ;
var readline = require('readline') ;

var googleAuth = require('google-auth-library') ;

//
// ABOUT
// Based on the sample below, but 'promisified' and made modular.
// https://developers.google.com/gmail/api/quickstart/nodejs
//

//
// HELPER FUNCTIONS
// No need to include in module.exports.
//

var getNewToken = function (oauth2Client, scopes, token_dir, token_filename ){
  // 
  // Use the given oauth2Client to ask for a token for the
  // user-provided scopes.
  // 
  return new Promise( function (resolve, reject) {
    var authUrl = oauth2Client.generateAuthUrl({
      access_type : 'offline' ,
      scope       : scopes 
    });
  
    console.log('Please authorize this app by visiting this url:\n' + authUrl );
  
    var rl = readline.createInterface({
      input  : process.stdin ,
      output : process.stdout
    });
  
    rl.question('Please enter the code from that page here:\n' , function(code) {
      rl.close() ;
      oauth2Client.getToken( code, function(err, token) {
        if(err) {
          reject('There was an error while trying to ' + 
                 'retrieve the access token.\n' + err 
          );
        }
        oauth2Client.credentials = token ;

        storeToken(token , token_dir , token_filename)
          .then( function(){
            //
            // Now that we have a token and we've stored it, we can resolve. 
            // 
            resolve(oauth2Client) ;
          })
          .catch( function (err ) {
            reject(err);
          })
        ;
      });
    });
  });
};

var storeToken = function(token,  token_dir, token_filename ) {
  // 
  // Try to store the given token.
  //
  return new Promise( function (resolve, reject) {
    try {
      //
      // First make sure that the directory exists.
      // If it doesn't exist, make one with that name.
      //
      fs.mkdirSync(token_dir) ;
    }
    catch (err) {
      if (err.code != 'EEXIST') {
        reject(err);
      }
    }
    const TOKEN_PATH = path.join(token_dir , token_filename) ; 
    fs.writeFile( TOKEN_PATH , JSON.stringify(token));
    resolve( 'Token stored to ' + TOKEN_PATH ) ;
  });
};

var authorize = function( credentials, token_dir , token_filename , scopes ){
  return new Promise( function (resolve, reject) {
    //
    // Gather info from the client-secret file.
    //

    var clientSecret = credentials.installed.client_secret    ;
    var clientId     = credentials.installed.client_id        ;
    var redirectUrl  = credentials.installed.redirect_uris[0] ;
  
    var auth         = new googleAuth()                       ;
    var oauth2Client = new auth.OAuth2(clientId, clientSecret , redirectUrl ) ;

    //
    // If the token already exists at the given token path, 
    // we're all set to peroform the callback with the token.
    // If the token doesn't exist, we need to get a new token.
    //
   
    fs.readFile( path.join(token_dir, token_filename) , function (err, token) {
      if (err) {
        reject( oauth2Client );
      }
      else {
        oauth2Client.credentials = JSON.parse(token) ;
        resolve(oauth2Client) ;
      }
    }); 
  });
};

//
// The main object for module.exports.
//
var exportable_obj = {} ;

//
// The function to be included in module.exports.
//

exportable_obj.setup = function( setup_obj ) {
  //
  // The user is expected to pass in a single object as a parameter.
  // The following properties are required:
  // 
  // 1) scopes              : Array of scopes to authorize.
  // 2) client_secrets_path : Path to client_secrets.json.
  // 3) token_filename      : A filename for the token to look for/
  //                          create if it doesn't already exist.
  // 4) token_dir           : (Optional) The user can speficy a directory
  //                          in which to look for the token, but the app will,
  //                          by default, look in HOME/HOMEPATH/USERPROFILE
  //
  return new Promise( function (resolve, reject ) {
  
    const CLIENT_SECRET_PATH = setup_obj.client_secret_path ;
    const SCOPES             = setup_obj.scopes             ;
    const TOKEN_FILENAME     = setup_obj.token_filename     ;
    const TOKEN_DIR          = setup_obj.token_dir || '' + 
      (
        process.env.HOME        || 
        process.env.HOMEPATH    || 
        process.env.USERPROFILE
      )  +
      '/.credentials/' 
    ;
  
    // 
    // Try to read the client_secret file
    // so that we have enough information to ask for a token. 
    // 
   
    fs.readFile(
      CLIENT_SECRET_PATH, // e.g., 'client_secret.json' , 
      function (err, content) {
        if (err) {
          reject('There was an error while loading client secrets.' ) ;
        }
        authorize( 
          JSON.parse(content) , 
          TOKEN_DIR           ,
          TOKEN_FILENAME      ,
          SCOPES          
        ).then( function( auth ){
          //
          // We're already authorized, so just go ahead and pass our
          // authorization back with resolve. 
          //
          resolve(auth);
        })
        .catch( function( oauth2Client ){ 
          //
          // We don't have a token. So, get a new one using the 
          // oauth2Client that the promise returned.
          //
          getNewToken (oauth2Client, SCOPES, TOKEN_DIR, TOKEN_FILENAME)
            .then( function( oauth2Client ) {
              resolve( oauth2Client ) ;
            }).catch( function (result ) {
              reject( 'Error getting new token: ' + result) ;
            })
          ;
        });
      }
    )
  });
};
 
module.exports = auth_offline_google_scopes ;
