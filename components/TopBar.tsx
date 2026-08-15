"use client";

interface Props {
  title: string;
  dataDate?: any;
  lastUpdate?: any;
  usdCny?: number;
}

export default function TopBar({
  title,
  usdCny,
}: Props) {
  return (
    <header
      className="
        h-20
        bg-white
        border-b
        border-gray-200
        px-10
        flex
        items-center
        justify-between
      "
    >

      {/* Left */}

      <div>
        <h1 className="text-3xl font-bold">
          {title}
        </h1>
      </div>


      {/* Right */}

      <div
        className="
          flex
          items-center
          gap-4
        "
      >

        {/* USD/CNY */}

        <div
          className="
            bg-gray-100
            px-4
            py-2
            rounded-lg
            text-sm
          "
        >
          <span className="text-gray-500">
            USD/CNY
          </span>

          <span className="ml-2 font-semibold">
            {usdCny != null
              ? usdCny.toFixed(4)
              : "--"}
          </span>
        </div>

      </div>

    </header>
  );
}