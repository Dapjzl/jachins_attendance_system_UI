export default async function handler(req, res) {

    try {
  
      const response = await fetch(
        'https://script.google.com/macros/s/AKfycbzw7WLhirxNQTbYHiCD24ese2-LjPjRnc3UY4SlF2MT0xN7Uau_SAHw_05GndV8QSA/exec',
        {
          method: 'POST',
          body: JSON.stringify(req.body),
        }
      );
  
      const text = await response.text();
  
      res.status(200).send(text);
  
    } catch (err) {
  
      res.status(500).json({
        success: false,
        message: err.toString()
      });
  
    }
  
  }