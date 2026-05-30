export default async function handler(req, res) {
    const token = req.query.token || '';
    const url =
      'https://script.google.com/macros/s/AKfycbzw7WLhirxNQTbYHiCD24ese2-LjPjRnc3UY4SlF2MT0xN7Uau_SAHw_05GndV8QSA/exec' +
      '?action=status&token=' + encodeURIComponent(token);
  
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