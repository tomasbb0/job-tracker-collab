const admin = require('firebase-admin');
const serviceAccount = {
  "type": "service_account",
  "project_id": "job-tracker-tomas",
  "private_key_id": "xxxxx",
  "private_key": "xxxxx",
  "client_email": "firebase-adminsdk-xxxxx@job-tracker-tomas.iam.gserviceaccount.com",
  "client_id": "xxxxx"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://job-tracker-tomas-default-rtdb.europe-west1.firebasedatabase.app"
});

const db = admin.database();
const jobs = [
  {company: "Anthropic", role: "Business Development Representative", location: "San Francisco", yearsExp: "1-3", link: "https://www.anthropic.com/careers", status: "not-started", notes: "", priority: true},
  {company: "OpenAI", role: "Business Development Representative", location: "San Francisco", yearsExp: "0-2", link: "https://openai.com/careers", status: "not-started", notes: "", priority: true},
  {company: "Google", role: "Account Strategist", location: "Dublin", yearsExp: "0-2", link: "https://careers.google.com/", status: "not-started", notes: "", priority: true}
];

jobs.forEach(job => {
  db.ref('positions').push(job);
})})})})})})})og('Jobs loaded')})})})})})})})og('Jobs lss.exit(0), 2000);
