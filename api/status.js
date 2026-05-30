export default async function handler(req, res) {
    const token = req.query.token || '';
    const url = process.env.APPS_SCRIPT_URL + '?action=status&token=' + encodeURIComponent(token);
  
    try {
      const response = await fetch(url);
      const text     = await response.text();
  
      if (text.startsWith('<!DOCTYPE html>')) {
        return res.status(500).json({ success: false, message: 'Apps Script returned HTML', raw: text.substring(0, 200) });
      }
  
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json(JSON.parse(text));
    } catch (err) {
      return res.status(500).json({ success: false, message: err.toString() });
    }
  }