import React from "react";

type FruitOptionRadioProps = {
  value: string; // valor atual, ex: "有り" ou "無し"
  onChange: (value: string) => void; // função chamada ao clicar
  name?: string; // opcional, útil quando há múltiplos grupos
  label?: string; // opcional — título como "*フルーツ盛り"
  required?: boolean;
  className?: string;
};

const FruitOptionRadio: React.FC<FruitOptionRadioProps> = ({
  value,
  onChange,
  name = "fruit-option",
  label = "フルーツ盛り",
  required = false,
  className = "",
}) => {
  console.log('FruitOptionRadio - valor atual:', value); 
  return (
    <div className={`input-group-radio ${className}`}>
      <label>
        {required && "*"}
        {label}
      </label>
      <div className="pill-group">
        <label className={`pill ${value === "無し" ? "active" : ""}`}>
          <input
            type="radio"
            name={name}
            value="無し"
            checked={value === "無し"}
            onChange={() => onChange("無し")}
          />
          無し
        </label>
        <label className={`pill ${value === "有り" ? "active" : ""}`}>
          <input
            type="radio"
            name={name}
            value="有り"
            checked={value === "有り"}
            onChange={() => onChange("有り")}
          />
          有り ＋648円（税込）
        </label>
      </div>
    </div>
  );
};

export default FruitOptionRadio;
