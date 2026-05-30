export default async function handler(req, res) {

    try {
  
      const response = await fetch(
        process.env.APPS_SCRIPT_URL,
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