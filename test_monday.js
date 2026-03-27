(async () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjYzMjU3ODk3NiwiYWFpIjoxMSwidWlkIjo5NTIwOTc5NSwiaWFkIjoiMjAyNi0wMy0xMlQyMjoyNTowMC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjgwMzkwNTQsInJnbiI6InVzZTEifQ.m2kNxXWZ3AxwOX8q-cE-HoffwEjXrJR1XvWjOp2KPp8';
    
    // Teste para ver como estão os items_page
    const query = `query {
      boards(ids: 8600368598) {
        name
        items_page(limit: 100) {
          items {
            id
            name
          }
        }
      }
    }`;

    try {
        const res = await fetch("https://api.monday.com/v2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": token,
                "API-Version": "2024-01" // Monday.com api version required since v2 is deprecating some parts
            },
            body: JSON.stringify({ query })
        });

        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch(err) {
        console.error(err);
    }
})();
