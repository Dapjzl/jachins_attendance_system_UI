export default async function handler(req, res) {

    const token = req.query.token || '';
  
    const url =
      'https://script.google.com/macros/s/AKfycbzw7WLhirxNQTbYHiCD24ese2-LjPjRnc3UY4SlF2MT0xN7Uau_SAHw_05GndV8QSA/exec' +
      '?action=employee&token=' +
      encodeURIComponent(token);
  
    try {
  
      console.log('API ROUTE HIT');
      console.log('TOKEN:', token);
      console.log('URL:', url);
  
      const response = await fetch(url);
  
      const text = await response.text();
  
      console.log('RAW RESPONSE:', text);
  
      // Check if Apps Script returned HTML error page
      if (text.startsWith('<!DOCTYPE html>')) {
  
        return res.status(500).json({
          success: false,
          message: 'Apps Script returned HTML instead of JSON',
          raw: text.substring(0, 200)
        });
  
      }
  
      // Parse JSON safely
      const data = JSON.parse(text);
  
      res.setHeader('Access-Control-Allow-Origin', '*');
  
      return res.status(200).json(data);
  
    } catch (err) {
  
      console.log(err);
  
      return res.status(500).json({
        success: false,
        message: err.toString()
      });
  
    }
  
  }