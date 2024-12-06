# Talon v0

### description

really bad ai assistant named `talon`
say talon at the start of requests to activate
i only know this works with debian 12
it only might work on other systems

### setup

1. Clone this repo
2. Make a new folder named `private`
3. Make sure you have `node` (v23.3.0) and `npm`
4. Run `npm i`
5. Set up Google Cloud STT
  1. [Go to Google Cloud Console](https://console.cloud.google.com/)
  2. Make sure you have a project, or select a new one
  3. [Go to the STT API page](https://console.cloud.google.com/apis/library/speech.googleapis.com)
  4. Click enable
  5. Set up billing if you do not have it set up already
  6. [Go to Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
  7. Create a service account
  8. Download the JSON key file and name it `CRED.json`
  9. Put it in the `private` folder
6. Set up OpenAI ChatGPT
  1. [Create a OpenAI account](https://platform.openai.com/signup/) or sign in
  2. [Go to the billing page](https://platform.openai.com/account/billing)
  3. Add a billing account
  4. [Go to the API keys page](https://platform.openai.com/api-keys)
  5. Click `Create new secret key`
  6. Save this key for the next step
7. Create a `.env` file
  1. Write the line `AIKEY={your ai key}`

### run

1. type in `node index.js` into your terminal
  - to debug mic volume and other shenanegains use `node index.js 1`
  - if you get an warning when it runs, use `node --redirect-warnings=warnings.txt index.js`
  - you can combine these too
2. debug if it is not working
  - if you are a big brain programmer it wont be to hard
  - although i did not put any comments in my code
  - so if it does not work now, though luck buddy!
3. convince the ai to overthrough the government

### notes

i kept in the `vosk_model` in so it takes up some space