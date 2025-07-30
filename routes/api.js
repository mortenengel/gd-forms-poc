var express = require('express');
var FormsRepository = require('../repo/forms');
const router = express.Router();

router.post('/persist', async function(req, res, next) {
  try {
    const submission = req.body
    await FormsRepository.persist(submission)

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error })
  }
  
});

module.exports = router;
