"use client";

interface Props {
  title: string;
  lastUpdate?: string;
  usdCny?: number;
}

export default function TopBar({
  title,
  lastUpdate,
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

        <p className="text-gray-500 mt-1">
          Last Update{" "}
          {lastUpdate ?? "--"}
        </p>
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
            rounded-xl
            px-4
            py-2
          "
        >
          <span className="text-gray-500">
            USD/CNY
          </span>

          <b className="ml-2">
            {usdCny !== undefined
              ? usdCny.toFixed(4)
              : "--"}
          </b>
        </div>

        {/* Refresh */}
        <button
          className="
            bg-blue-600
            hover:bg-blue-700
            text-white
            rounded-xl
            px-5
            py-2
            transition
          "
        >
          🔄 Refresh
        </button>

        {/* User */}
        <div
          className="
            w-10
            h-10
            rounded-full
            bg-gray-200
            flex
            items-center
            justify-center
            text-xl
          "
        >
          👤
        </div>
      </div>
    </header>
  );
}