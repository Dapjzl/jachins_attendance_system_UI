export default async function handler(req, res) {

    const token = req.query.token || '';
  
    const url =
      'https://script.google.com/macros/s/AKfycbzw7WLhirxNQTbYHiCD24ese2-LjPjRnc3UY4SlF2MT0xN7Uau_SAHw_05GndV8QSA/exec' +
      '?action=employee&token=' +
      encodeURIComponent(token);
  
    try {
  
      const response = await fetch(url);
  
      const text = await response.text();
  
      res.setHeader('Access-Control-Allow-Origin', '*');
  
      res.status(200).send(text);
  
    } catch (err) {
  
      res.status(500).json({
        success: false,
        message: err.toString()
      });
  
    }
  
  }