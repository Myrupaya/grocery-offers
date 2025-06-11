import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import "./App.css";

const GroceryOffers = () => {
    const [creditCards, setCreditCards] = useState([]);
  const [debitCards, setDebitCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCreditCards, setFilteredCreditCards] = useState([]);
  const [filteredDebitCards, setFilteredDebitCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [groceryOffers, setGroceryOffers] = useState([]);
  const [noOffersMessage, setNoOffersMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Check screen width to detect if it's mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Fetch and parse CSV file
  useEffect(() => {
    const fetchAndParseCSV = (filePath) =>
      new Promise((resolve, reject) => {
        Papa.parse(filePath, {
          download: true,
          header: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error),
        });
      });

    const extractCards = (data) => {
      const creditCards = new Set();
      const debitCards = new Set();

      data.forEach((row) => {
        if (row["Applicable Credit Card"]) {
          row["Applicable Credit Card"]
            .split(",")
            .map((card) => card.trim())
            .forEach((card) => creditCards.add(card));
        }
        if (row["Applicable Debit Card"]) {
          row["Applicable Debit Card"]
            .split(",")
            .map((card) => card.trim())
            .forEach((card) => debitCards.add(card));
        }
      });

      return {
        creditCards: Array.from(creditCards),
        debitCards: Array.from(debitCards),
      };
    };

    const fetchData = async () => {
      try {
        const groceryData = await fetchAndParseCSV("/Corrected_Grocery_Offers.csv");
        const { creditCards, debitCards } = extractCards(groceryData);
        setCreditCards(creditCards);
        setDebitCards(debitCards);
        setFilteredCreditCards(creditCards);
        setFilteredDebitCards(debitCards);
      } catch (error) {
        console.error("Error fetching or parsing CSV file:", error);
      }
    };

    fetchData();
  }, []);

  // Fetch offers based on selected card
  const fetchOffers = async (card) => {
    const fetchAndParseCSV = (filePath) =>
      new Promise((resolve, reject) => {
        Papa.parse(filePath, {
          download: true,
          header: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error),
        });
      });

    const filterOffers = (data, card) =>
      data.filter(
        (row) =>
          row["Applicable Credit Card"]?.includes(card) ||
          row["Applicable Debit Card"]?.includes(card)
      );

    try {
      const groceryData = await fetchAndParseCSV("/Corrected_Grocery_Offers.csv");
      const filteredOffers = filterOffers(groceryData, card);
      setGroceryOffers(filteredOffers);

      if (filteredOffers.length === 0) {
        setNoOffersMessage("No offers found for this card.");
      } else {
        setNoOffersMessage("");
      }
    } catch (error) {
      console.error("Error fetching or filtering offers:", error);
    }
  };

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value === "") {
      setFilteredCreditCards(creditCards);
      setFilteredDebitCards(debitCards);
      setNoOffersMessage("");
      setSelectedCard("");
      setGroceryOffers([]);
      return;
    }

    const matchingCreditCards = creditCards.filter((card) =>
      card.toLowerCase().includes(value.toLowerCase())
    );
    const matchingDebitCards = debitCards.filter((card) =>
      card.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredCreditCards(matchingCreditCards);
    setFilteredDebitCards(matchingDebitCards);

    if (matchingCreditCards.length === 0 && matchingDebitCards.length === 0) {
      setNoOffersMessage("No offers found for this card.");
    } else {
      setNoOffersMessage("");
    }
  };

  // Handle card selection
  const handleCardSelect = (card) => {
    setSelectedCard(card);
    setSearchTerm(card);
    setFilteredCreditCards([]);
    setFilteredDebitCards([]);
    fetchOffers(card);
  };


  return (
    <div className="container">
<<<<<<< HEAD
      {/* Navbar Component - remains exactly the same */}
      <nav className="navbar">
        <div className="logoContainer">
          <a href="https://www.myrupaya.in/">
            <img
              src="https://static.wixstatic.com/media/f836e8_26da4bf726c3475eabd6578d7546c3b2~mv2.jpg/v1/crop/x_124,y_0,w_3152,h_1458/fill/w_909,h_420,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/dark_logo_white_background.jpg"
              alt="MyRupaya Logo"
              className="logo"
            />
          </a>
          <div className="linksContainer">
            <a href="https://www.myrupaya.in/" className="link">
              Home
            </a>
          </div>
        </div>
      </nav>

      {/* Title in white container box */}
      <div className="title-container">
        <h1 className="main-title">Grocery Offers</h1>
      </div>

      {/* 50-50 split section - now responsive */}
      <div className="split-section">
        <div className="text-section">
          <h2>Find the best grocery offers</h2>
          <p>
            Discover exclusive credit and debit card offers for grocery shopping.
            Search for your card to see available discounts and promo codes that
            can help you save money on your grocery purchases.
          </p>
        </div>
        <div className="image-section">
          <img
            src="https://via.placeholder.com/500x300?text=Grocery+Shopping"
            alt="Grocery Shopping"
            className="responsive-image"
          />
        </div>
      </div>

      {/* Centered search and dropdown section */}
      <div className="search-container">
        <div className="search-section">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search your credit/debit card..."
            className="search-input"
          />

          {(filteredCreditCards.length > 0 || filteredDebitCards.length > 0) && (
            <ul className="dropdown-list">
              {filteredCreditCards.length > 0 && (
                <>
                  <li className="dropdown-header">Credit Cards</li>
                  {filteredCreditCards.map((card, index) => (
                    <li
                      key={`credit-${index}`}
                      className="dropdown-item"
                      onClick={() => handleCardSelect(card)}
                    >
                      {card}
                    </li>
                  ))}
                </>
              )}

              {filteredDebitCards.length > 0 && (
                <>
                  <li className="dropdown-header">Debit Cards</li>
                  {filteredDebitCards.map((card, index) => (
                    <li
                      key={`debit-${index}`}
                      className="dropdown-item"
                      onClick={() => handleCardSelect(card)}
                    >
                      {card}
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
=======
      <div className="title-box">
        <h1>Grocery Offers</h1>
      </div>

      <div className="content-row">
        <div className="text-section">
          <h2>Find the Best Grocery Discounts</h2>
          <p>
            Discover amazing discounts and cashback offers on groceries 
            using your credit or debit cards. Search for your card to see 
            available offers from various stores.
          </p>
        </div>
        <div className="image-section">
          <img 
            src="https://via.placeholder.com/400x300?text=Grocery+Items" 
            alt="Grocery items" 
            className="grocery-image"
          />
        </div>
      </div>

      <div className="main">
        <div className="search-container">
          <div className="search-dropdown">
            <input
              id="creditCardSearch"
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search your card..."
              className="search-input"
            />

            {(filteredCreditCards.length > 0 || filteredDebitCards.length > 0) && (
              <ul className="dropdown-list">
                {filteredCreditCards.length > 0 && (
                  <>
                    <li className="dropdown-header">Credit Cards</li>
                    {filteredCreditCards.map((card, index) => (
                      <li
                        key={`credit-${index}`}
                        className="dropdown-item"
                        onClick={() => handleCardSelect(card)}
                      >
                        {card}
                      </li>
                    ))}
                  </>
                )}

                {filteredDebitCards.length > 0 && (
                  <>
                    <li className="dropdown-header">Debit Cards</li>
                    {filteredDebitCards.map((card, index) => (
                      <li
                        key={`debit-${index}`}
                        className="dropdown-item"
                        onClick={() => handleCardSelect(card)}
                      >
                        {card}
                      </li>
                    ))}
                  </>
                )}
              </ul>
            )}
          </div>
>>>>>>> 9977f3031a2ae1df83d5a5541d5a93a944a1ad29
        </div>
      </div>

<<<<<<< HEAD
      {/* Offers display section */}
      {noOffersMessage && (
        <p className="no-offers-message">{noOffersMessage}</p>
      )}

      {selectedCard && !noOffersMessage && (
        <div className="offers-container">
          {groceryOffers.length > 0 && (
            <div className="offers-grid">
              {groceryOffers.map((offer, index) => (
                <div key={index} className="offer-card">
                  <h3>Offers on {offer.App}</h3>
                  <p>
                    <strong>Offer:</strong> {offer["Description of the offer"]}
                  </p>
                  <p>
                    <strong>Coupon Code:</strong> {offer["Coupon Code/Link"]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAQ section with 3 columns in one row on desktop */}
      <div className="faq-container">
        <h2 className="section-title">Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-card">
            <h3>How do I use these offers?</h3>
            <p>
              Search for your card, find the offer you want, and apply the coupon
              code during checkout at the specified grocery platform.
            </p>
=======
        {noOffersMessage && (
          <div className="message-box">
            <p>{noOffersMessage}</p>
          </div>
        )}

        {selectedCard && !noOffersMessage && (
          <div className="offers-grid">
            {groceryOffers.map((offer, index) => (
              <div key={index} className="offer-card">
                <h3>{offer.App}</h3>
                <div className="offer-details">
                  <p><span className="detail-label">Offer:</span> {offer["Description of the offer"]}</p>
                  {offer["Coupon Code/Link"] && (
                    <p><span className="detail-label">Code:</span> {offer["Coupon Code/Link"]}</p>
                  )}
                </div>
              </div>
            ))}
>>>>>>> 9977f3031a2ae1df83d5a5541d5a93a944a1ad29
          </div>
          <div className="faq-card">
            <h3>Are these offers valid for all users?</h3>
            <p>
              Most offers are valid for cardholders, but some may have additional
              terms and conditions specified by the bank.
            </p>
          </div>
          <div className="faq-card">
            <h3>How often are offers updated?</h3>
            <p>
              We update our database regularly with new offers. Check back
              frequently for the latest grocery shopping promotions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroceryOffers;